import { PrismaClient } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });
const prisma = new PrismaClient();

async function main() {
  const email = 'mehdi.shiravi@gmail.com';
  console.log('Using email:', email);
  const user = await prisma.user.findFirst({
    where: { email },
    include: { organization: true },
  });

  if (!user) {
    console.error('Operator user not found');
    process.exit(1);
  }

  const payload = {
    sub: user.id,
    orgId: user.orgId,
    orgSlug: user.organization.slug,
    email: user.email,
  };

  const secret = process.env.JWT_SECRET || 'test-secret';
  const token = jwt.sign(payload, secret, { expiresIn: '1h' });

  console.log('Token generated. Fetching /platform-admin/2fa/status...');

  const res = await fetch('http://localhost:4000/api/v1/platform-admin/2fa/status', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Response:', text);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
