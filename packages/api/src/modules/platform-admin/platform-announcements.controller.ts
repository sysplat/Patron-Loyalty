import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';
import { Public } from '../../common/decorators/public.decorator';
import { PlatformAuditService } from '../../common/audit/platform-audit.service';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AnnouncementService } from '../announcement/announcement.service';
import { PlatformAnnouncementDto, UpdatePlatformAnnouncementDto } from './dto/platform.dto';

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller({ path: 'platform-admin/announcements', version: '1' })
export class PlatformAnnouncementsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: PlatformAuditService,
    private readonly announcementService: AnnouncementService,
  ) {}

  private normalizePolicy(input: {
    type: string;
    deliveryMode?: 'banner' | 'modal' | 'blocking';
    dismissBehavior?: 'allowed' | 'disallowed';
    requireAcknowledgment?: boolean;
  }) {
    const isCritical = input.type === 'critical';
    return {
      deliveryMode: input.deliveryMode ?? 'banner',
      dismissBehavior: isCritical ? 'disallowed' : (input.dismissBehavior ?? 'allowed'),
      requireAcknowledgment: isCritical ? true : (input.requireAcknowledgment ?? false),
    };
  }

  @Get()
  @UseGuards(PlatformOperatorGuard)
  @ApiOperation({ summary: 'List platform announcements' })
  async list() {
    const items = await this.prisma.platformAnnouncement.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: items };
  }

  @Public()
  @Get('active')
  @ApiOperation({ summary: 'Get active platform announcements (public)' })
  async getActive() {
    const items = await this.prisma.platformAnnouncement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return { success: true, data: items };
  }

  @Post()
  @UseGuards(PlatformOperatorGuard)
  @ApiOperation({ summary: 'Create a platform announcement' })
  async create(@CurrentUser() user: AuthenticatedUser, @Body() body: PlatformAnnouncementDto) {
    const policy = this.normalizePolicy(body);
    const announcement = await this.prisma.platformAnnouncement.create({
      data: {
        title: body.title,
        body: body.body,
        type: body.type,
        deliveryMode: policy.deliveryMode,
        dismissBehavior: policy.dismissBehavior,
        requireAcknowledgment: policy.requireAcknowledgment,
        isActive: true,
      },
    });

    await this.audit.log({
      actorUserId: user.userId,
      actorEmail: user.email,
      eventType: 'platform.announcement.created',
      severity: 'info',
      metadata: {
        title: body.title,
        type: body.type,
        deliveryMode: policy.deliveryMode,
        dismissBehavior: policy.dismissBehavior,
        requireAcknowledgment: policy.requireAcknowledgment,
      },
    });

    return { success: true, data: announcement };
  }

  @Patch(':id')
  @UseGuards(PlatformOperatorGuard)
  @ApiOperation({ summary: 'Update a platform announcement' })
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: UpdatePlatformAnnouncementDto,
  ) {
    const existing = await this.prisma.platformAnnouncement.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Announcement not found');
    }
    const policy = this.normalizePolicy({
      type: body.type ?? existing.type,
      deliveryMode: (body.deliveryMode ?? existing.deliveryMode) as 'banner' | 'modal' | 'blocking',
      dismissBehavior: (body.dismissBehavior ?? existing.dismissBehavior) as
        | 'allowed'
        | 'disallowed',
      requireAcknowledgment:
        body.requireAcknowledgment !== undefined
          ? body.requireAcknowledgment
          : existing.requireAcknowledgment,
    });
    const announcement = await this.prisma.platformAnnouncement.update({
      where: { id },
      data: {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.body !== undefined ? { body: body.body } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        type: body.type ?? existing.type,
        deliveryMode: policy.deliveryMode,
        dismissBehavior: policy.dismissBehavior,
        requireAcknowledgment: policy.requireAcknowledgment,
      },
    });

    await this.audit.log({
      actorUserId: user.userId,
      actorEmail: user.email,
      eventType: 'platform.announcement.updated',
      severity: 'info',
      metadata: { announcementId: id, updates: { ...body } },
    });

    return { success: true, data: announcement };
  }

  @Get(':id/compliance')
  @UseGuards(PlatformOperatorGuard)
  @ApiOperation({ summary: 'Compliance stats for a platform announcement' })
  async compliance(@Param('id') id: string) {
    const data = await this.announcementService.getPlatformComplianceForOperator(id);
    return { success: true, data };
  }

  @Delete(':id')
  @UseGuards(PlatformOperatorGuard)
  @ApiOperation({ summary: 'Delete a platform announcement' })
  async delete(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const ann = await this.prisma.platformAnnouncement.findUnique({ where: { id } });
    if (!ann) {
      throw new NotFoundException('Announcement not found');
    }
    await this.prisma.platformAnnouncement.delete({ where: { id } });

    await this.audit.log({
      actorUserId: user.userId,
      actorEmail: user.email,
      eventType: 'platform.announcement.deleted',
      severity: 'warning',
      metadata: { announcementId: id, title: ann?.title },
    });

    return { success: true, data: { deleted: true } };
  }
}
