import { PrismaClient } from '@prisma/client';
import { isPlatformOperator } from '../../api/src/common/platform-operator.util';

const prisma = new PrismaClient();
async function main() {
  const userId = '6567c10d-4203-4bb8-bc5f-f6a3ab88ddc8'; // mehdi.shiravi@gmail.com
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      adminTwoFactorEnabled: true,
      organization: { select: { slug: true } },
    },
  });

  const resolvedEmail = String(dbUser?.email ?? '').trim();
  const resolvedSlug = String(dbUser?.organization?.slug ?? '').trim();

  console.log('dbUser:', dbUser);
  console.log('resolvedSlug:', resolvedSlug);
  console.log('isPlatformOperator:', isPlatformOperator(userId, resolvedEmail, resolvedSlug));
}
main().finally(() => prisma.$disconnect());
