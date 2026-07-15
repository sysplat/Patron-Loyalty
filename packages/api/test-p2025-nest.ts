import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { LoyaltyQueueEventsService } from './src/modules/loyalty/loyalty-queue-events.service';
import { QLESSQ_QUEUE_INTEGRATION_EVENTS } from '@queueplatform/shared';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(LoyaltyQueueEventsService);

  const orgId = 'b7987bf3-692f-408b-a868-ce1a145bb60e';

  try {
    const res = await service.processRemoteEvent(orgId, {
      event: QLESSQ_QUEUE_INTEGRATION_EVENTS.TICKET_COMPLETED,
      sourceId: '9b8c9dd4-5b76-4d44-99cc-e77a08bae9e3',
      branchId: 'ac34446c-3f3d-4715-b798-7636ed5f5097',
      customerId: 'e9838cbb-fbad-4c5f-8fb1-2c92a4448ab8',
      customer: {
        externalId: 'e9838cbb-fbad-4c5f-8fb1-2c92a4448ab8',
        name: 'ssadsa',
        phone: '+15551234567',
      },
    });
    console.log('RESULT', res);
  } catch (e: any) {
    console.error('ERROR IS', e.code, e.message);
  }

  await app.close();
}
main().finally(() => process.exit(0));
