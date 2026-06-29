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
import { LoyaltyConnectorObservabilityService } from './loyalty-connector-observability.service';
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

  const connectorObs = {
    logIngest: vi.fn(),
    recordClientError: vi.fn(),
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
        { provide: LoyaltyConnectorObservabilityService, useValue: connectorObs },
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
    app.useGlobalFilters(
      new GlobalExceptionFilter(requestContext as RequestContextService, (orgId, route, status) => {
        void connectorObs.recordClientError(orgId, route, status);
      }),
    );
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

    expect(queueEvents.processRemoteEvent).toHaveBeenCalledWith(ORG_ID, {
      ...payload,
      connectorVersion: 1,
    });
    expect(res.body).toEqual({ ok: true, idempotent: false });
  });

  it('returns 400 for earn payload missing externalTxnId', async () => {
    connectorObs.recordClientError.mockClear();
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
    expect(connectorObs.recordClientError).toHaveBeenCalledWith(ORG_ID, 'points/earn', 400);
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

  it('delegates upsert to integration service with org id', async () => {
    integration.upsertCustomer.mockResolvedValue({
      customerId: '00000000-0000-0000-0000-0000000000cc',
      externalId: 'qlessq-cust-upsert',
      created: true,
    });

    const body = {
      externalId: 'qlessq-cust-upsert',
      name: 'Upsert Patron',
      email: 'upsert@example.com',
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/customers/upsert')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send(body)
      .expect(200);

    expect(integration.upsertCustomer).toHaveBeenCalledWith(ORG_ID, body);
    expect(res.body).toMatchObject({
      customerId: '00000000-0000-0000-0000-0000000000cc',
      created: true,
    });
  });

  it('returns 404 when lookup finds no patron', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    integration.lookupCustomer.mockRejectedValue(new NotFoundException('Patron not found'));

    await request(app.getHttpServer())
      .get('/api/v1/loyalty/integrations/v1/customers/lookup')
      .query({ externalId: 'missing-patron' })
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .expect(404);

    expect(integration.lookupCustomer).toHaveBeenCalledWith(ORG_ID, {
      customerId: undefined,
      email: undefined,
      phone: undefined,
      externalId: 'missing-patron',
    });
  });
  it('returns lookup result from integration service', async () => {
    integration.lookupCustomer.mockResolvedValue({
      customerId: '00000000-0000-0000-0000-0000000000aa',
      externalId: 'qlessq-cust-lookup',
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/loyalty/integrations/v1/customers/lookup')
      .query({ externalId: 'qlessq-cust-lookup' })
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .expect(200);

    expect(integration.lookupCustomer).toHaveBeenCalledWith(ORG_ID, {
      customerId: undefined,
      email: undefined,
      phone: undefined,
      externalId: 'qlessq-cust-lookup',
    });
    expect(res.body).toEqual({
      customerId: '00000000-0000-0000-0000-0000000000aa',
      externalId: 'qlessq-cust-lookup',
    });
  });

  it('returns idempotent earn response on replay', async () => {
    integration.earnPoints.mockResolvedValue({
      idempotent: true,
      accountId: 'acc-1',
      points: 10,
    });

    const body = {
      customerId: '00000000-0000-0000-0000-000000000001',
      eventType: 'MANUAL',
      externalTxnId: 'txn-contract-replay',
      points: 10,
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/points/earn')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send(body)
      .expect(200);

    expect(res.body).toMatchObject({ idempotent: true, accountId: 'acc-1' });
  });

  it('forwards review.submitted queue-events', async () => {
    queueEvents.processRemoteEvent.mockResolvedValue({ ok: true, idempotent: false });

    const payload = {
      event: 'review.submitted',
      sourceId: 'review-contract-1',
      customerId: '00000000-0000-0000-0000-000000000001',
      rating: 5,
      connectorVersion: 1,
    };

    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/queue-events')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send(payload)
      .expect(200);

    expect(queueEvents.processRemoteEvent).toHaveBeenCalledWith(ORG_ID, payload);
    expect(connectorObs.logIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: ORG_ID,
        route: 'queue-events',
        event: 'review.submitted',
        outcome: 'ok',
      }),
    );
  });

  it('forwards appointment.completed queue-events', async () => {
    queueEvents.processRemoteEvent.mockResolvedValue({ ok: true, idempotent: true });

    const payload = {
      event: 'appointment.completed',
      sourceId: 'appt-contract-1',
      branchId: '00000000-0000-0000-0000-000000000001',
      customer: { externalId: 'qlessq-appt-cust', name: 'Appt Patron' },
    };

    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/queue-events')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send(payload)
      .expect(200);

    expect(queueEvents.processRemoteEvent).toHaveBeenCalledWith(ORG_ID, {
      ...payload,
      connectorVersion: 1,
    });
    expect(connectorObs.logIngest).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'idempotent' }),
    );
  });

  it('returns 400 for redeem payload missing rewardId', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/rewards/redeem')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send({ customerId: '00000000-0000-0000-0000-000000000001' })
      .expect(400);

    expect(integration.redeemReward).not.toHaveBeenCalled();
  });

  it('delegates redeem to integration service with org id', async () => {
    integration.redeemReward.mockResolvedValue({ redemptionId: 'red-1', pointsCost: 100 });

    const body = {
      customerId: '00000000-0000-0000-0000-000000000001',
      rewardId: '00000000-0000-0000-0000-0000000000bb',
      externalTxnId: 'redeem-contract-1',
    };

    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/rewards/redeem')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send(body)
      .expect(200);

    expect(integration.redeemReward).toHaveBeenCalledWith(ORG_ID, body);
  });

  it('returns 400 for coupon validate payload missing code', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/coupons/validate')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send({ customerId: '00000000-0000-0000-0000-000000000001' })
      .expect(400);

    expect(integration.validateCoupon).not.toHaveBeenCalled();
  });

  it('delegates coupon validate to integration service', async () => {
    integration.validateCoupon.mockResolvedValue({ valid: true, code: 'SAVE10' });

    const body = { code: 'SAVE10', customerId: '00000000-0000-0000-0000-000000000001' };

    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/coupons/validate')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send(body)
      .expect(200);

    expect(integration.validateCoupon).toHaveBeenCalledWith(ORG_ID, body);
  });

  it('returns 400 for coupon redeem without patron reference', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/coupons/redeem')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send({ code: 'SAVE10' })
      .expect(400);

    expect(integration.redeemCoupon).not.toHaveBeenCalled();
  });

  it('delegates coupon redeem to integration service', async () => {
    integration.redeemCoupon.mockResolvedValue({ ok: true });

    const body = {
      code: 'SAVE10',
      externalId: 'qlessq-cust-coupon',
    };

    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/coupons/redeem')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send(body)
      .expect(200);

    expect(integration.redeemCoupon).toHaveBeenCalledWith(ORG_ID, body);
  });

  it('returns 400 for wallet adjust missing amountCents', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/wallet/adjust')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send({
        customerId: '00000000-0000-0000-0000-000000000001',
        type: 'CREDIT',
      })
      .expect(400);

    expect(integration.adjustWallet).not.toHaveBeenCalled();
  });

  it('delegates wallet adjust to integration service', async () => {
    integration.adjustWallet.mockResolvedValue({ balanceCents: 5000 });

    const body = {
      customerId: '00000000-0000-0000-0000-000000000001',
      type: 'CREDIT',
      amountCents: 500,
      description: 'POS credit',
    };

    await request(app.getHttpServer())
      .post('/api/v1/loyalty/integrations/v1/wallet/adjust')
      .set('X-Loyalty-Api-Key', 'loyalty_live_test')
      .send(body)
      .expect(200);

    expect(integration.adjustWallet).toHaveBeenCalledWith(ORG_ID, body);
  });
});
