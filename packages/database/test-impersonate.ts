import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'parsasamandizadeh@gmail.com' },
  });
  console.log('User:', user?.id);

  // login
  const loginRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'parsasamandizadeh@gmail.com', password: 'password123' }), // I don't know the password...
  });
}
main().catch(console.error);
