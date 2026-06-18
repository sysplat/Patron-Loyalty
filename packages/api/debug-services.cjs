const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tableInfo = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'services';
  `;
  console.log('Columns in services table:', JSON.stringify(tableInfo, null, 2));

  const serviceData = await prisma.service.findMany({ take: 5 });
  console.log('First 5 services:', JSON.stringify(serviceData, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
