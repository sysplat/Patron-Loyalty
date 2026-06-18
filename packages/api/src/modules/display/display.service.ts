import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { RedisService } from '../../redis/redis.service';
import { randomBytes, createHash, randomUUID } from 'crypto';
import { PlanLimitService } from '../billing/plan-limit.service';
import { resolveAllowedBranchIds } from '../../common/rbac/effective-branch-scope';
import type { DisplayTokenPayload } from '../../common/guards/display-auth.guard';

type PairingRedisPayload = {
  mode: 'reverse';
  sessionId: string;
  status: 'pending' | 'linked';
  orgId?: string;
  branchId?: string;
  deviceId?: string;
};

type PairingSessionRedis = {
  code: string;
  status: 'pending' | 'linked';
  deviceId?: string;
  // Tenant org of the linked device. Needed so the claim-time UPDATE can satisfy the
  // display_devices RLS WITH CHECK (writes require app.current_org_id even under bypass).
  orgId?: string;
  apiKey?: string;
  sessionToken?: string;
};

/**
 * Manages display devices for branch TV boards.
 *
 * Security model:
 * 1. Reverse pairing: TV shows a 6-char code → staff links branch in dashboard → TV claims credentials
 * 2. API Key: Long-lived credential in HttpOnly cookies on the TV browser
 * 3. Session Token (JWT): Short-lived, auto-refreshed via API key while the page is used
 */
@Injectable()
export class DisplayService {
  private readonly logger = new Logger(DisplayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly planLimits: PlanLimitService,
  ) {}

  private withOrg<T>(orgId: string, callback: (tx: PrismaClient) => Promise<T>): Promise<T> {
    return this.prisma.withTenant(orgId, callback);
  }

  // ─── Helpers ────────────────────────────────────

  private hashSha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private generateApiKey(): string {
    // 32 bytes → 64 hex chars. Prefixed for easy identification in logs.
    return `dsp_${randomBytes(32).toString('hex')}`;
  }

  private getPairingExpirySeconds(): number {
    const expiryMinutes = this.config.get<number>('app.displayCodeExpiryMinutes') ?? 15;
    return expiryMinutes * 60;
  }

  private generatePairingCodeString(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    const bytes = randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += alphabet[bytes[i] % alphabet.length];
    }
    return code;
  }

  private normalizePairingCode(code: string): string {
    return code.toUpperCase().trim();
  }

  /** Owner/org-wide admin: any branch in org. Others: only assigned branch ids. */
  private async assertBranchInPrincipalScope(
    orgId: string,
    userId: string,
    branchId: string,
  ): Promise<void> {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (allowed === null) {
      return;
    }
    if (allowed.length === 0 || !allowed.includes(branchId)) {
      throw new ForbiddenException('Branch not in your scope');
    }
  }

  private signDisplayToken(deviceId: string, orgId: string, branchId: string): string {
    const ttlSeconds = this.config.get<number>('app.displayTokenTtlSeconds') ?? 86400;

    const payload: Omit<DisplayTokenPayload, 'iat' | 'exp'> = {
      did: deviceId,
      oid: orgId,
      bid: branchId,
      typ: 'display',
    };

    return this.jwtService.sign(payload, { expiresIn: ttlSeconds });
  }

  // ─── Admin CRUD ────────────────────────────────

  async list(orgId: string, branchId?: string, allowedBranchIds?: string[] | null) {
    const where: any = { orgId };
    if (branchId) {
      where.branchId = branchId;
    } else if (Array.isArray(allowedBranchIds) && allowedBranchIds.length === 0) {
      return [];
    } else if (allowedBranchIds && allowedBranchIds.length > 0) {
      where.branchId = { in: allowedBranchIds };
    }
    return this.withOrg(orgId, (tx) =>
      tx.displayDevice.findMany({
        where,
        include: { branch: { select: { id: true, name: true, slug: true } }, theme: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async listForPrincipal(orgId: string, userId: string, branchId?: string) {
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (branchId) {
      if (allowed !== null && (allowed.length === 0 || !allowed.includes(branchId))) {
        throw new ForbiddenException('Branch not in your scope');
      }
      return this.list(orgId, branchId, undefined);
    }
    return this.list(orgId, undefined, allowed);
  }

  async getById(orgId: string, deviceId: string) {
    const device = await this.withOrg(orgId, (tx) =>
      tx.displayDevice.findFirst({
        where: { id: deviceId, orgId },
        include: { branch: true, theme: true },
      }),
    );
    if (!device) throw new NotFoundException('Display device not found');
    return device;
  }

  async getByIdForPrincipal(orgId: string, userId: string, deviceId: string) {
    const device = await this.getById(orgId, deviceId);
    const allowed = await resolveAllowedBranchIds(this.prisma, orgId, userId);
    if (allowed === null) {
      return device;
    }
    if (
      allowed !== null &&
      (allowed.length === 0 || !device.branchId || !allowed.includes(device.branchId))
    ) {
      throw new ForbiddenException('Branch not in your scope');
    }
    return device;
  }

  // ─── Reverse pairing (TV shows code) ───────────

  /**
   * TV requests a pairing code to display. Admin enters the same code in the dashboard to link a branch.
   */
  async requestReversePairingCode() {
    const expirySeconds = this.getPairingExpirySeconds();
    const expiryMinutes = Math.round(expirySeconds / 60);
    const code = this.generatePairingCodeString();
    const sessionId = randomUUID();
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    const pairingPayload: PairingRedisPayload = {
      mode: 'reverse',
      sessionId,
      status: 'pending',
    };

    await this.redis.setJson(`pairing:${code}`, pairingPayload, expirySeconds);
    await this.redis.setJson(
      `pairing:session:${sessionId}`,
      { code, status: 'pending' } satisfies PairingSessionRedis,
      expirySeconds,
    );

    return { code, sessionId, expiresAt, expiryMinutes };
  }

  async getReversePairingStatus(sessionId: string) {
    const session = await this.redis.getJson<PairingSessionRedis>(`pairing:session:${sessionId}`);
    if (!session) {
      return { status: 'expired' as const };
    }
    return {
      status: session.status,
      deviceId: session.deviceId,
    };
  }

  /**
   * Admin links a TV-shown code to a branch (RBAC: branch must be in principal scope).
   */
  async linkScreenForPrincipal(
    orgId: string,
    userId: string,
    data: { code: string; branchId: string; name?: string; deviceId?: string; deviceType?: string },
  ) {
    await this.assertBranchInPrincipalScope(orgId, userId, data.branchId);
    if (data.deviceId) {
      await this.getByIdForPrincipal(orgId, userId, data.deviceId);
    }
    return this.linkScreen(orgId, data);
  }

  /**
   * Links a TV-shown code to a branch. Creates a new device or reconnects an existing one (rotates API key).
   */
  async linkScreen(
    orgId: string,
    data: { code: string; branchId: string; name?: string; deviceId?: string; deviceType?: string },
  ) {
    const normalizedCode = this.normalizePairingCode(data.code);
    const pairingData = await this.redis.getJson<PairingRedisPayload>(`pairing:${normalizedCode}`);

    if (!pairingData || pairingData.mode !== 'reverse') {
      throw new BadRequestException('Invalid or expired pairing code');
    }
    if (pairingData.status !== 'pending') {
      throw new BadRequestException('This pairing code has already been used');
    }

    const deviceName = data.name?.trim() || `Display ${normalizedCode}`;

    const apiKey = this.generateApiKey();
    const apiKeyHash = this.hashSha256(apiKey);
    const branchId = data.branchId;
    const deviceType = data.deviceType ?? 'tv';

    const device = await this.withOrg(orgId, async (tx) => {
      const branch = await tx.branch.findFirst({
        where: { id: data.branchId, orgId },
        select: { id: true, name: true },
      });
      if (!branch) {
        throw new BadRequestException('Branch not found or not in your organization');
      }

      if (data.deviceId) {
        const existing = await tx.displayDevice.findFirst({
          where: { id: data.deviceId, orgId },
        });
        if (!existing) throw new NotFoundException('Display device not found');
        if (existing.branchId && existing.branchId !== branchId) {
          throw new BadRequestException('Device belongs to a different branch');
        }
        await this.redis.del(`display:auth:${existing.id}`);
        return tx.displayDevice.update({
          where: { id: existing.id },
          data: {
            branchId,
            name: data.name?.trim() || existing.name,
            type: deviceType,
            apiKeyHash,
            status: 'online',
            lastSeenAt: new Date(),
          },
        });
      }

      const currentDevices = await tx.displayDevice.count({ where: { orgId } });
      const limitCheck = await this.planLimits.checkLimit(orgId, 'maxDevices', currentDevices);
      if (!limitCheck.allowed) {
        throw new BadRequestException('Device limit reached for current subscription plan');
      }
      return tx.displayDevice.create({
        data: {
          orgId,
          branchId,
          name: deviceName,
          type: deviceType,
          apiKeyHash,
          status: 'online',
          lastSeenAt: new Date(),
        },
      });
    });

    const sessionToken = this.signDisplayToken(device.id, orgId, branchId);
    const expirySeconds = this.getPairingExpirySeconds();
    const claimTtlSeconds = Math.min(120, expirySeconds);

    await this.redis.setJson(
      `pairing:${normalizedCode}`,
      {
        mode: 'reverse',
        sessionId: pairingData.sessionId,
        status: 'linked',
        orgId,
        branchId,
        deviceId: device.id,
      } satisfies PairingRedisPayload,
      claimTtlSeconds,
    );

    await this.redis.setJson(
      `pairing:session:${pairingData.sessionId}`,
      {
        code: normalizedCode,
        status: 'linked',
        deviceId: device.id,
        orgId,
        apiKey,
        sessionToken,
      } satisfies PairingSessionRedis,
      claimTtlSeconds,
    );

    this.logger.log(`Display screen linked: ${device.id} (${device.name}) for branch ${branchId}`);

    return { device };
  }

  /**
   * TV claims credentials after admin linked the code. Credentials are removed from Redis after pickup.
   */
  async claimReversePairing(sessionId: string, deviceFingerprint: string) {
    const session = await this.redis.getJson<PairingSessionRedis>(`pairing:session:${sessionId}`);
    if (
      !session ||
      session.status !== 'linked' ||
      !session.apiKey ||
      !session.sessionToken ||
      !session.deviceId
    ) {
      throw new BadRequestException(
        'Pairing session not ready or expired — ask your admin to link the screen again',
      );
    }

    const fingerprintHash = deviceFingerprint ? this.hashSha256(deviceFingerprint) : null;

    // Resolve the device's org for the RLS WITH CHECK. Prefer the org stored on the linked
    // session; fall back to a bypassed read for any in-flight session written before this field
    // existed.
    let orgId = session.orgId;
    if (!orgId) {
      const existing = await this.prisma.withBypassRls((tx) =>
        tx.displayDevice.findFirst({
          where: { id: session.deviceId },
          select: { orgId: true },
        }),
      );
      orgId = existing?.orgId;
    }

    const device = await this.prisma.withBypassRls(
      (tx) =>
        tx.displayDevice.update({
          where: { id: session.deviceId },
          data: {
            fingerprintHash,
            status: 'online',
            lastSeenAt: new Date(),
          },
        }),
      orgId ? { orgId } : undefined,
    );

    const result = {
      device,
      apiKey: session.apiKey,
      sessionToken: session.sessionToken,
    };

    await this.redis.del(`pairing:session:${sessionId}`);
    if (session.code) {
      await this.redis.del(`pairing:${session.code}`);
    }

    return result;
  }

  // ─── Token Refresh (API Key → new JWT) ─────────

  /**
   * Exchanges a permanent API key for a fresh short-lived session token.
   * Called by the TV when its current JWT expires.
   *
   * Optionally validates the device fingerprint if one was stored during pairing.
   */
  async refreshToken(apiKey: string, deviceFingerprint?: string) {
    const apiKeyHash = this.hashSha256(apiKey);

    const device = await this.prisma.withBypassRls((tx) =>
      tx.displayDevice.findFirst({
        where: { apiKeyHash },
        select: { id: true, orgId: true, branchId: true, status: true, fingerprintHash: true },
      }),
    );

    if (!device) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (device.status !== 'online' && device.status !== 'paired') {
      throw new UnauthorizedException('Device has been revoked');
    }

    // Optional fingerprint validation
    if (device.fingerprintHash && deviceFingerprint) {
      const incomingHash = this.hashSha256(deviceFingerprint);
      if (incomingHash !== device.fingerprintHash) {
        this.logger.warn(`Fingerprint mismatch for device ${device.id} — possible cloned key`);
        throw new UnauthorizedException('Device fingerprint mismatch');
      }
    }

    if (!device.branchId) {
      throw new BadRequestException('Device is not assigned to a branch');
    }

    const sessionToken = this.signDisplayToken(device.id, device.orgId, device.branchId);

    // Update lastSeenAt. The display_devices RLS policy enforces the tenant org_id in its
    // WITH CHECK clause (writes require app.current_org_id, even under bypass), so we must
    // pass the device's orgId here or the UPDATE fails with a 42501 RLS violation.
    await this.prisma.withBypassRls(
      (tx) =>
        tx.displayDevice.update({
          where: { id: device.id },
          data: { lastSeenAt: new Date() },
        }),
      { orgId: device.orgId },
    );

    return { sessionToken, deviceId: device.id };
  }

  // ─── Device Management ─────────────────────────

  async update(
    orgId: string,
    deviceId: string,
    data: Partial<{ name: string; themeId: string; config: any }>,
  ) {
    await this.getById(orgId, deviceId);
    return this.withOrg(orgId, (tx) => tx.displayDevice.update({ where: { id: deviceId }, data }));
  }

  /**
   * Authenticated heartbeat — called by paired displays to report they're alive.
   * Uses the display context set by the DisplayAuthGuard.
   */
  async heartbeat(deviceId: string, orgId: string) {
    return this.prisma.withBypassRls(
      (tx) =>
        tx.displayDevice.update({
          where: { id: deviceId },
          data: { lastSeenAt: new Date(), status: 'online' },
        }),
      { orgId },
    );
  }

  /**
   * Revokes a display device by setting its status to 'revoked'.
   * The DisplayAuthGuard's Redis cache will expire within 60s,
   * after which the device can no longer fetch data.
   */
  async revoke(orgId: string, deviceId: string) {
    await this.getById(orgId, deviceId);

    // Invalidate the guard's positive cache immediately
    await this.redis.del(`display:auth:${deviceId}`);

    return this.withOrg(orgId, (tx) =>
      tx.displayDevice.update({
        where: { id: deviceId },
        data: { status: 'revoked', apiKeyHash: null, sessionToken: null },
      }),
    );
  }

  async delete(orgId: string, deviceId: string) {
    await this.getById(orgId, deviceId);

    // Invalidate the guard's positive cache
    await this.redis.del(`display:auth:${deviceId}`);

    await this.withOrg(orgId, (tx) => tx.displayDevice.delete({ where: { id: deviceId } }));
  }

  // ─── Themes ────────────────────────────────────

  async listThemes(orgId: string) {
    return this.withOrg(orgId, (tx) =>
      tx.displayTheme.findMany({
        where: { orgId },
        orderBy: { name: 'asc' },
      }),
    );
  }

  async createTheme(orgId: string, data: { name: string; type?: string; config: any }) {
    return this.withOrg(orgId, (tx) =>
      tx.displayTheme.create({
        data: { orgId, name: data.name, type: data.type ?? 'tv', config: data.config },
      }),
    );
  }

  async updateTheme(orgId: string, themeId: string, data: Partial<{ name: string; config: any }>) {
    const theme = await this.withOrg(orgId, (tx) =>
      tx.displayTheme.findFirst({ where: { id: themeId, orgId } }),
    );
    if (!theme) throw new NotFoundException('Theme not found');
    return this.withOrg(orgId, (tx) => tx.displayTheme.update({ where: { id: themeId }, data }));
  }

  async deleteTheme(orgId: string, themeId: string) {
    const theme = await this.withOrg(orgId, (tx) =>
      tx.displayTheme.findFirst({ where: { id: themeId, orgId } }),
    );
    if (!theme) throw new NotFoundException('Theme not found');
    await this.withOrg(orgId, (tx) => tx.displayTheme.delete({ where: { id: themeId } }));
  }
}
