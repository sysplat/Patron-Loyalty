import { config } from 'dotenv';
import { join } from 'path';
config({ path: join(__dirname, '../../../.env') });
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AppointmentService } from '../src/modules/appointment/appointment.service';

async function run() {
  console.log('🚀 Bootstrapping application context for reminder scan...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const appointmentService = app.get(AppointmentService);

  try {
    console.log('🔍 Scanning for due reminders...');
    const count = await appointmentService.sendDueReminders();
    console.log(`✅ Success! Sent ${count} reminders.`);
  } catch (error) {
    console.error('❌ Failed to send reminders:', error);
  } finally {
    await app.close();
    process.exit(0);
  }
}

run();
