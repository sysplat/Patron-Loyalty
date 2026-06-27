import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { randomBytes, createHmac } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

/**
 * Manages customer-configured webhook endpoints.
 * Dispatches events to registered URLs with HMAC-signed payloads.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  private isDisallowedIpAddress(ip: string): boolean {
    if (ip === '::1') return true;
    if (ip.startsWith('127.')) return true;
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    if (ip.startsWith('169.254.')) return true;
    if (ip.startsWith('172.')) {
      const second = Number.parseInt(ip.split('.')[1] ?? '', 10);
      if (Number.isFinite(second) && second >= 16 && second <= 31) return true;
    }
    if (ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd')) return true;
    if (ip.toLowerCase().startsWith('fe80:')) return true;
    return false;
  }

  private async assertSafeWebhookUrl(urlRaw: string): Promise<void> {
    const parsed = new URL(urlRaw);
    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('Webhook URL must use HTTPS');
    }
    const hostname = parsed.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local')) {
      throw new BadRequestException('Webhook URL cannot target localhost/private network hosts');
    }
    const directIp = isIP(hostname) ? hostname : null;
    if (directIp && this.isDisallowedIpAddress(directIp)) {
      throw new BadRequestException('Webhook URL cannot target private or loopback IP addresses');
    }
    if (!directIp) {
      if (process.env.NODE_ENV === 'test') {
        return;
      }
      const resolved = await lookup(hostname, { all: true, verbatim: true });
      if (resolved.length === 0) {
        throw new BadRequestException('Webhook host did not resolve to an IP address');
      }
      for (const address of resolved) {
        if (this.isDisallowedIpAddress(address.address)) {
          throw new BadRequestException(
            'Webhook URL cannot target private or link-local network addresses',
          );
        }
      }
    }
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly requestContext: RequestContextService,
  ) {}

  async list(orgId: string) {
    const rows = await this.prisma.withTenant(orgId, (tx) =>
      tx.webhookEndpoint.findMany({
        where: { orgId },
        orderBy: { createdAt: 'desc' },
      }),
    );
    return rows.map(({ secret: _secret, ...endpoint }) => endpoint);
  }

  async create(orgId: string, data: { url: string; events: string[] }) {
    await this.assertSafeWebhookUrl(data.url);
    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    const created = await this.prisma.withTenant(orgId, (tx) =>
      tx.webhookEndpoint.create({
        data: {
          orgId,
          url: data.url,
          events: data.events,
          secret,
          status: 'active',
        },
      }),
    );
    const { secret: _secret, ...endpoint } = created;
    return endpoint;
  }

  async update(
    orgId: string,
    id: string,
    data: Partial<{ url: string; events: string[]; status: string }>,
  ) {
    const endpoint = await this.prisma.withTenant(orgId, (tx) =>
      tx.webhookEndpoint.findFirst({ where: { id, orgId } }),
    );
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
    if (typeof data.url === 'string' && data.url.trim()) {
      await this.assertSafeWebhookUrl(data.url);
    }
    return this.prisma.withTenant(orgId, (tx) =>
      tx.webhookEndpoint.update({ where: { id }, data }),
    );
  }

  async delete(orgId: string, id: string) {
    const endpoint = await this.prisma.withTenant(orgId, (tx) =>
      tx.webhookEndpoint.findFirst({ where: { id, orgId } }),
    );
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
    await this.prisma.withTenant(orgId, (tx) => tx.webhookEndpoint.delete({ where: { id } }));
  }

  async rotateSecret(orgId: string, id: string) {
    const endpoint = await this.prisma.withTenant(orgId, (tx) =>
      tx.webhookEndpoint.findFirst({ where: { id, orgId } }),
    );
    if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    const updated = await this.prisma.withTenant(orgId, (tx) =>
      tx.webhookEndpoint.update({ where: { id }, data: { secret } }),
    );
    return { ...updated, secret };
  }

  /**
   * Dispatches an event to all registered webhook endpoints for the org.
   * Uses HMAC-SHA256 signing so recipients can verify authenticity.
   * Fire-and-forget with a 10-second timeout per endpoint.
   */
  async dispatchEvent(
    orgId: string,
    eventType: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const endpoints = await this.prisma.withTenant(orgId, (tx) =>
      tx.webhookEndpoint.findMany({
        where: { orgId, status: 'active' },
      }),
    );

    const matching = endpoints.filter((ep) => {
      const events = (ep.events as string[]) ?? [];
      return events.includes('*') || events.includes(eventType);
    });

    if (matching.length === 0) return;

    const requestId = this.requestContext.getRequestId();
    const body = JSON.stringify({
      event: eventType,
      data: payload,
      timestamp: new Date().toISOString(),
    });

    const deliveries = matching.map(async (ep) => {
      let timeout: NodeJS.Timeout | undefined;
      try {
        const signature = createHmac('sha256', ep.secret).update(body).digest('hex');
        const controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 10000);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': eventType,
        };
        if (requestId) {
          headers['X-Request-Id'] = requestId;
        }

        // Re-validate the URL right before the request to prevent DNS rebinding attacks
        await this.assertSafeWebhookUrl(ep.url);

        const res = await fetch(ep.url, {
          method: 'POST',
          headers,
          body,
          signal: controller.signal,
        });

        if (timeout) {
          clearTimeout(timeout);
          timeout = undefined;
        }

        await this.prisma.withTenant(orgId, (tx) =>
          tx.webhookEndpoint.update({
            where: { id: ep.id },
            data: { lastTriggeredAt: new Date() },
          }),
        );

        if (!res.ok) {
          this.logger.warn(`Webhook ${ep.id} responded ${res.status} for event ${eventType}`);
        }
      } catch (err) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = undefined;
        }
        this.logger.error(
          `Webhook delivery failed for ${ep.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });

    await Promise.allSettled(deliveries);
  }
}
