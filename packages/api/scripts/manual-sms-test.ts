import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import 'dotenv/config';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL!);

async function main() {
  const thresholds = [1440, 60];
  const now = new Date();
  const phone = '+16048618530';

  console.log('--- Manual Appointment Reminder Test ---');
  console.log('Target Phone:', phone);
  console.log('Current Time (UTC):', now.toISOString());

  for (const minutes of thresholds) {
    console.log(`\nChecking threshold: ${minutes}m`);
    // We look for appointments scheduled at [now + minutes - 15, now + minutes + 15]
    // to be generous in our manual test scan.
    const windowStart = new Date(now.getTime() + (minutes - 30) * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (minutes + 30) * 60 * 1000);

    const appointments = await prisma.appointment.findMany({
      where: {
        status: 'confirmed',
        scheduledAt: { gte: windowStart, lt: windowEnd },
        customerPhone: phone,
      },
      include: { organization: true, branch: true, service: true },
    });

    console.log(`Found ${appointments.length} appointments for ${minutes}m window.`);

    for (const appt of appointments) {
      console.log(`Processing Appointment: ${appt.id} (${appt.customerName})`);
      console.log(`Scheduled At: ${appt.scheduledAt.toISOString()}`);

      const redisKey = `reminder:${appt.id}:${minutes}`;
      const alreadySent = await redis.get(redisKey);

      if (alreadySent) {
        console.log(
          `⚠️ Reminder already sent for appointment ${appt.id} at ${minutes}m (Redis key: ${redisKey})`,
        );
        continue;
      }

      const body = `Reminder: ${appt.customerName}, your ${appt.service.name} appointment is in ${minutes === 60 ? '1 hour' : '24 hours'}. (Manual Test)`;
      console.log(`🚀 SENDING SMS to ${appt.customerPhone}...`);
      console.log(`Body: "${body}"`);

      await sendTestSms(appt.customerPhone!, body);

      await redis.set(redisKey, 'sent', 'EX', 86400);
      console.log(`✅ Marked as sent in Redis: ${redisKey}`);
    }
  }
}

async function sendTestSms(to: string, body: string) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.error('❌ Twilio credentials missing in .env!');
    return;
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const params = new URLSearchParams();
  params.append('To', to);
  params.append('From', from);
  params.append('Body', body);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    const result: any = await response.json();
    if (response.ok) {
      console.log('✅ SMS sent successfully via Twilio! SID:', result.sid);
    } else {
      console.error('❌ Failed to send SMS via Twilio:', result.message || result);
    }
  } catch (err: any) {
    console.error('❌ Error calling Twilio API:', err.message);
  }
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
    redis.disconnect();
  });
