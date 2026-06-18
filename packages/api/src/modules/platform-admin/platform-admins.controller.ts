import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { INTERNAL_PLATFORM_ORG_SLUG } from '@queueplatform/shared';
import * as bcrypt from 'bcrypt';
import { CreatePlatformAdminDto } from './dto/platform.dto';

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller({ path: 'platform-admin/admins', version: '1' })
@UseGuards(PlatformOperatorGuard)
export class PlatformAdminsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all platform admin users' })
  async list() {
    const org = await this.prisma.organization.findUnique({
      where: { slug: INTERNAL_PLATFORM_ORG_SLUG },
    });
    if (!org) throw new NotFoundException('Internal platform org not found');

    const admins = await this.prisma.withBypassRls((tx) =>
      tx.user.findMany({
        where: { orgId: org.id },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    );

    return { success: true, data: admins };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific platform admin' })
  async getById(@Param('id') id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { slug: INTERNAL_PLATFORM_ORG_SLUG },
    });
    if (!org) throw new NotFoundException('Internal platform org not found');

    const admin = await this.prisma.withBypassRls((tx) =>
      tx.user.findUnique({
        where: { id },
        select: {
          id: true,
          orgId: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
    );

    if (!admin || admin.orgId !== org.id) {
      throw new NotFoundException('Admin user not found');
    }

    return { success: true, data: admin };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new platform admin user' })
  async create(@CurrentUser() operator: AuthenticatedUser, @Body() body: CreatePlatformAdminDto) {
    if (!body.email || !body.password || body.password.length < 8) {
      throw new BadRequestException('Email and password (min 8 chars) are required');
    }

    const org = await this.prisma.organization.findUnique({
      where: { slug: INTERNAL_PLATFORM_ORG_SLUG },
    });
    if (!org) throw new NotFoundException('Internal platform org not found');

    const emailNorm = body.email.toLowerCase();

    const existingInternal = await this.prisma.withBypassRls((tx) =>
      tx.user.findFirst({
        where: { email: emailNorm, orgId: org.id },
      }),
    );
    if (existingInternal) {
      throw new ConflictException('This email is already a platform administrator');
    }

    const passwordHash = await bcrypt.hash(body.password, 12);

    const existingAccount = await this.prisma.account.findUnique({
      where: { email: emailNorm },
    });

    let user: {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      status: string;
      createdAt: Date;
    };

    if (existingAccount) {
      const ok = await bcrypt.compare(body.password, existingAccount.passwordHash);
      if (!ok) {
        throw new BadRequestException(
          'Password does not match your existing QlessQ account for this email.',
        );
      }
      user = await this.prisma.withBypassRls((tx) =>
        tx.user.create({
          data: {
            accountId: existingAccount.id,
            orgId: org.id,
            email: emailNorm,
            firstName: body.firstName || null,
            lastName: body.lastName || null,
            passwordHash: existingAccount.passwordHash,
            emailVerified: true,
            status: 'active',
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            createdAt: true,
          },
        }),
      );
    } else {
      user = await this.prisma.withBypassRls(async (tx) => {
        const acc = await tx.account.create({
          data: {
            email: emailNorm,
            passwordHash,
            emailVerified: true,
            phone: null,
          },
        });
        return tx.user.create({
          data: {
            accountId: acc.id,
            orgId: org.id,
            email: emailNorm,
            firstName: body.firstName || null,
            lastName: body.lastName || null,
            passwordHash,
            emailVerified: true,
            status: 'active',
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            createdAt: true,
          },
        });
      });
    }

    await this.audit.log({
      actorUserId: operator.userId,
      actorEmail: operator.email,
      eventType: 'platform.admin.created',
      severity: 'warning',
      metadata: { newAdminEmail: body.email },
    });

    return { success: true, data: user };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a platform admin user' })
  async remove(@CurrentUser() operator: AuthenticatedUser, @Param('id') id: string) {
    // Prevent self-deletion
    if (id === operator.userId) {
      throw new BadRequestException('You cannot delete your own admin account');
    }

    const user = await this.prisma.withBypassRls((tx) =>
      tx.user.findUnique({
        where: { id },
        select: { id: true, email: true, orgId: true },
      }),
    );
    if (!user) throw new NotFoundException('Admin user not found');

    const org = await this.prisma.organization.findUnique({
      where: { slug: INTERNAL_PLATFORM_ORG_SLUG },
    });
    if (!org || user.orgId !== org.id) {
      throw new BadRequestException('User is not a platform admin');
    }

    await this.prisma.withBypassRls((tx) => tx.user.delete({ where: { id } }));

    await this.audit.log({
      actorUserId: operator.userId,
      actorEmail: operator.email,
      eventType: 'platform.admin.removed',
      severity: 'critical',
      metadata: { removedAdminEmail: user.email },
    });

    return { success: true, data: { deleted: true } };
  }
}
