import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { getObservabilityRelease } from '@queueplatform/shared';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformOperatorGuard } from '../support/platform-operator.guard';

type PrismaMigrationRow = {
  migration_name: string;
  finished_at: Date | null;
  started_at: Date | null;
  applied_steps_count: number;
  rolled_back_at: Date | null;
};

/**
 * Read-only deployment signals for platform operators (no secrets).
 */
@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller({ path: 'platform-admin/deployment', version: '1' })
@UseGuards(PlatformOperatorGuard)
export class PlatformDeploymentController {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('features')
  @ApiOperation({ summary: 'Feature gates from environment (visit journeys, etc.)' })
  getFeatures() {
    return {
      success: true,
      data: {
        visitJourneysGloballyDisabled: this.config.get<boolean>(
          'app.visitJourneysGloballyDisabled',
          false,
        ),
        visitJourneysLegacyGlobalOn: this.config.get<boolean>(
          'app.visitJourneysLegacyGlobalOn',
          false,
        ),
      },
    };
  }

  @Get('status')
  @ApiOperation({
    summary: 'Release, DB migration history, and migrate-on-start flag (post-deploy checks)',
  })
  async getStatus() {
    const runMigrationsOnStart =
      (process.env.RUN_DB_MIGRATIONS_ON_START ?? '').toLowerCase() === 'true';
    const nodeEnv = process.env.NODE_ENV ?? 'development';
    const release = getObservabilityRelease();

    let migrations: {
      name: string;
      finishedAt: string | null;
      startedAt: string | null;
      appliedStepsCount: number;
      rolledBackAt: string | null;
    }[] = [];
    let migrationsError: string | null = null;
    let lastApplied: { name: string; finishedAt: string | null } | null = null;

    try {
      const rows = await this.prisma.$queryRaw<PrismaMigrationRow[]>(Prisma.sql`
        SELECT migration_name, finished_at, started_at, applied_steps_count, rolled_back_at
        FROM _prisma_migrations
        ORDER BY COALESCE(finished_at, started_at) DESC NULLS LAST
        LIMIT 12
      `);
      migrations = rows.map((r) => ({
        name: r.migration_name,
        finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
        startedAt: r.started_at ? new Date(r.started_at).toISOString() : null,
        appliedStepsCount: r.applied_steps_count,
        rolledBackAt: r.rolled_back_at ? new Date(r.rolled_back_at).toISOString() : null,
      }));
      const applied = migrations.find((m) => m.finishedAt && !m.rolledBackAt);
      if (applied) {
        lastApplied = { name: applied.name, finishedAt: applied.finishedAt };
      }
    } catch (err) {
      migrationsError = err instanceof Error ? err.message : String(err);
    }

    return {
      success: true,
      data: {
        release,
        environment: nodeEnv,
        runMigrationsOnStart,
        lastAppliedMigration: lastApplied,
        recentMigrations: migrations,
        migrationsError,
        opsLinks: {
          sentry:
            process.env.NEXT_PUBLIC_SENTRY_DASHBOARD_URL?.trim() ||
            process.env.SENTRY_DASHBOARD_URL?.trim() ||
            (process.env.SENTRY_ORG?.trim()
              ? `https://${process.env.SENTRY_ORG.trim()}.sentry.io`
              : 'https://sysplat.sentry.io'),
          betterStackUptime:
            process.env.NEXT_PUBLIC_BETTER_STACK_DASHBOARD_URL?.trim() ||
            process.env.BETTER_STACK_DASHBOARD_URL?.trim() ||
            'https://uptime.betterstack.com',
          betterStackStatus:
            process.env.NEXT_PUBLIC_BETTER_STACK_STATUS_URL?.trim() ||
            process.env.BETTER_STACK_STATUS_URL?.trim() ||
            'https://sysplat.betteruptime.com',
          betterStackLogs:
            process.env.NEXT_PUBLIC_BETTER_STACK_LOGS_URL?.trim() ||
            process.env.BETTER_STACK_LOGS_URL?.trim() ||
            'https://logs.betterstack.com',
        },
        note: runMigrationsOnStart
          ? 'API runs migrate on start (single-replica only).'
          : 'Migrations are applied out-of-band (typical for Railway / multi-replica). Check lastAppliedMigration after deploys.',
      },
    };
  }
}
