import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Guides new organizations through the post-signup setup wizard.
 * Tracks onboarding step completion and validates prerequisites.
 */
@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getProgress(orgId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { onboardingStep: true },
    });

    const steps = await this.prisma.withTenant(orgId, (tx) =>
      tx.onboardingProgress.findMany({
        where: { orgId },
        orderBy: { updatedAt: 'asc' },
      }),
    );

    return {
      currentStep: org.onboardingStep,
      completedSteps: steps.filter((s) => s.completed).map((s) => s.step),
      data: steps.reduce((acc, s) => ({ ...acc, [s.step]: s.data }), {} as Record<string, unknown>),
    };
  }

  async updateServiceSelection(orgId: string, modules: string[]) {
    await this.prisma.withTenant(orgId, (tx) =>
      tx.onboardingProgress.upsert({
        where: { orgId_step: { orgId, step: 'service_selection' } },
        update: { completed: true, data: { modules } },
        create: { orgId, step: 'service_selection', completed: true, data: { modules } },
      }),
    );

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { onboardingStep: 'company_profile' },
    });

    return { step: 'company_profile' };
  }

  async updateCompanyProfile(
    orgId: string,
    data: {
      name: string;
      website?: string;
      industry: string;
      timezone: string;
      country: string;
      logoUrl?: string;
    },
  ) {
    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        name: data.name,
        website: data.website,
        industry: data.industry,
        timezone: data.timezone,
        country: data.country,
        logoUrl: data.logoUrl,
        onboardingStep: 'location_setup',
      },
    });

    await this.prisma.withTenant(orgId, (tx) =>
      tx.onboardingProgress.upsert({
        where: { orgId_step: { orgId, step: 'company_profile' } },
        update: { completed: true, data },
        create: { orgId, step: 'company_profile', completed: true, data },
      }),
    );

    return { step: 'location_setup' };
  }

  async updateLocation(orgId: string, data: { address: string; lat: number; lng: number }) {
    // Create default branch with location
    const org = await this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });

    await this.prisma.withTenant(orgId, (tx) =>
      tx.branch.upsert({
        where: { orgId_slug: { orgId, slug: 'main' } },
        update: { address: data.address, lat: data.lat, lng: data.lng },
        create: {
          orgId,
          name: `${org.name} - Main Branch`,
          slug: 'main',
          address: data.address,
          lat: data.lat,
          lng: data.lng,
          timezone: org.timezone,
        },
      }),
    );

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { onboardingStep: 'review_setup' },
    });

    await this.prisma.withTenant(orgId, (tx) =>
      tx.onboardingProgress.upsert({
        where: { orgId_step: { orgId, step: 'location_setup' } },
        update: { completed: true, data },
        create: { orgId, step: 'location_setup', completed: true, data },
      }),
    );

    return { step: 'review_setup' };
  }

  async complete(orgId: string) {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });

    if (org.onboardingStep === 'completed') {
      throw new BadRequestException('Onboarding already completed');
    }

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { onboardingStep: 'completed' },
    });

    await this.prisma.withTenant(orgId, (tx) =>
      tx.onboardingProgress.upsert({
        where: { orgId_step: { orgId, step: 'completed' } },
        update: { completed: true },
        create: { orgId, step: 'completed', completed: true },
      }),
    );

    return { step: 'completed', redirectTo: '/dashboard' };
  }
}
