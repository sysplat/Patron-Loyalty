import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  Injectable,
  UnauthorizedException,
  VersioningType,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { ZodValidationPipe } from 'nestjs-zod';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { LoyaltyIntegrationController } from './loyalty-integration.controller';
import { LoyaltyIntegrationService } from './loyalty-integration.service';
import { LoyaltyQueueEventsService } from './loyalty-queue-events.service';
import { LOYALTY_ORG_ID_REQUEST_KEY, LoyaltyApiKeyGuard } from './guards/loyalty-api-key.guard';

const ORG_ID = '00000000-0000-0000-0000-000000000099';

@Injectable()
class TestLoyaltyApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const header = req.headers['x-loyalty-api-key'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw || typeof raw !== 'string') {
      throw new UnauthorizedException('Missing X-Loyalty-Api-Key header');
    }
    if (raw !== 'loyalty_live_test') {
      throw new UnauthorizedException('Invalid loyalty API key');
    }
    req[LOYALTY_ORG_ID_REQUEST_KEY] = ORG_ID;
    return true;
  }
}

describe('LoyaltyIntegrationController (HTTP contract)', () => {
  let app: INestApplication;

  const integration = {
    lookupCustomer: vi.fn(),
    upsertCustomer: vi.fn(),
    earnPoints: vi.fn(),
    redeemReward: vi.fn(),
    validateCoupon: vi.fn(),
    redeemCoupon: vi.fn(),
    adjustWallet: vi.fn(),
  };

  const queueEvents = {
    processRemoteEvent: vi.fn(),
  };

  const requestContext = {
    run: (_ctx: unknown, fn: () => void) => fn(),
    getContext: () => ({}),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [LoyaltyIntegrationController],
      providers: [
        { provide: LoyaltyIntegrationService, useValue: integration },
        { provide: LoyaltyQueueEventsService, useValue: queueEvents },
        { provide: RequestContextService, useValue: requestContext },
      ],
    })
      .overrideGuard(LoyaltyApiKeyGuard)
      .useClass(TestLoyaltyApiKeyGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
      prefix: 'api/v',
    });
    app.useGlobalFilters(new GlobalExceptionFilter(requestContext as RequestContextService));
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 when X-Loyalty-Api-Key is missing', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/queue-events')
      .send({})
      .expect(401);
  });

  it('returns 401 when API key is invalid', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/queue-events')
      .set('X-Loyalty-Api-Key', 'bad-key')
      .send({})
      .expect(401);
  });

  it('returns 400 for invalid queue-events payload', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/queue-events')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send({ event: 'not-a-real-event' })
      .expect(400);

    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed' },
    });
    expect(queueEvents.processRemoteEvent).not.toHaveBeenCalled();
  });

  it('forwards valid queue-events to the service with org id from the guard', async () => {
    queueEvents.processRemoteEvent.mockResolvedValue({ ok: true, idempotent: false });

    const payload = {
      event: 'ticket.completed',
      sourceId: 'ticket-contract-1',
      branchId: '00000000-0000-0000-0000-000000000001',
      customer: {
        externalId: 'qlessq-cust-contract',
        name: 'Contract Patron',
      },
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/queue-events')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send(payload)
      .expect(200);

    expect(queueEvents.processRemoteEvent).toHaveBeenCalledWith(ORG_ID, payload);
    expect(res.body).toEqual({ ok: true, idempotent: false });
  });

  it('returns 400 for earn payload missing externalTxnId', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/points/earn')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send({
        eventType: 'MANUAL',
        customerId: '00000000-0000-0000-0000-000000000001',
        points: 10,
      })
      .expect(400);

    expect(integration.earnPoints).not.toHaveBeenCalled();
  });

  it('delegates earn to integration service with org id', async () => {
    integration.earnPoints.mockResolvedValue({
      idempotent: false,
      accountId: 'acc-1',
      points: 10,
    });

    const body = {
      customerId: '00000000-0000-0000-0000-000000000001',
      eventType: 'MANUAL',
      externalTxnId: 'txn-contract-1',
      points: 10,
    };

    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/points/earn')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send(body)
      .expect(200);

    expect(integration.earnPoints).toHaveBeenCalledWith(ORG_ID, body);
  });

  it('returns 400 for upsert payload missing required name', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/customers/upsert')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send({ externalId: 'qlessq-cust-contract' })
      .expect(400);

    expect(integration.upsertCustomer).not.toHaveBeenCalled();
  });
});
