import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AuthLoginService } from './src/modules/auth/auth-login.service';
import { RequestContextService } from './src/common/request-context/request-context.service';

async function main() {
  process.env.DATABASE_URL =
    'postgresql://postgres:VQNivofSODMbUDGykbJgOdXJdKNTQKUd@nozomi.proxy.rlwy.net:32755/railway';
  const app = await NestFactory.createApplicationContext(AppModule);
  // Can't run NestFactory easily due to missing module deps.
  await app.close();
}
main().finally(() => process.exit(0));
