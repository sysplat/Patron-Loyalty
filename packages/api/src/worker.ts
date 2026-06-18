import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

/**
 * Dedicated worker entrypoint for background jobs.
 * Bootstraps the application context (dependency injection, Prisma, BullMQ processors)
 * without starting the HTTP server, saving memory and isolating heavy processing from
 * the main API event loop.
 */
async function bootstrap() {
  const logger = new Logger('SchedulerWorker');

  // createApplicationContext initializes providers (including BullMQ processors)
  // but does not bind to an HTTP port.
  const app = await NestFactory.createApplicationContext(AppModule);

  app.enableShutdownHooks();

  logger.log('Scheduler worker successfully started (HTTP disabled).');
}

bootstrap().catch((err) => {
  console.error('Failed to start scheduler worker', err);
  process.exit(1);
});
