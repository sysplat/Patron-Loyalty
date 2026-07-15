import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { CustomerService } from './src/modules/customer/customer.service';

async function main() {
  process.env.DATABASE_URL =
    'postgresql://postgres:VQNivofSODMbUDGykbJgOdXJdKNTQKUd@nozomi.proxy.rlwy.net:32755/railway';
  const app = await NestFactory.createApplicationContext(AppModule);
  const service = app.get(CustomerService);

  const orgId = 'b7987bf3-692f-408b-a868-ce1a145bb60e';

  try {
    const res = await service.list(orgId, {});
    console.log('TOTAL CUSTOMERS', res.meta.total);
    console.log('CUSTOMERS', res.data.length);
  } catch (e: any) {
    console.error('ERROR IS', e.code, e.message);
  }

  await app.close();
}
main().finally(() => process.exit(0));
