import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const prisma = new PrismaClient();
const email = 'psamandi@golestanfoundation.org';

async function main() {
  console.log(`Starting cleanup for: ${email}`);

  // 1. Delete Notifications associated with the email in payload
  const notifications = await prisma.notification.findMany({
    where: {
      OR: [
        { payload: { path: ['to'], equals: email } },
        { payload: { path: ['recipientEmail'], equals: email } },
      ],
    },
  });
  console.log(`Found ${notifications.length} notifications to delete.`);
  for (const n of notifications) {
    await prisma.notificationLog.deleteMany({ where: { notificationId: n.id } });
    await prisma.notification.delete({ where: { id: n.id } });
  }

  // 2. Delete Appointments
  const appointments = await prisma.appointment.deleteMany({
    where: { customerEmail: email },
  });
  console.log(`Deleted ${appointments.count} appointments.`);

  // 3. Delete Tickets
  const tickets = await prisma.ticket.deleteMany({
    where: { customerEmail: email },
  });
  console.log(`Deleted ${tickets.count} tickets.`);

  // 4. Delete Customer
  const customer = await prisma.customer.deleteMany({
    where: { email: email.toLowerCase() },
  });
  console.log(`Deleted ${customer.count} customers.`);

  // 5. Delete User
  const user = await prisma.user.findFirst({
    where: { email: email.toLowerCase() },
  });

  if (user) {
    // Delete sessions
    await prisma.session.deleteMany({ where: { userId: user.id } });
    // Delete user
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`Deleted user ${user.id}.`);
  } else {
    console.log('No user found with this email.');
  }

  console.log('Cleanup complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
