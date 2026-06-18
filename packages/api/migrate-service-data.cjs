const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('[MIGRATION] Starting services data sync...');
  
  // 1. Manually check if the old column still exists in DB
  const columns = await prisma.$queryRaw`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_name = 'services' AND column_name = 'avg_service_time';
  `;

  if (columns.length === 0) {
    console.log('[MIGRATION] Old column avg_service_time not found. Assuming schema is already clean.');
    return;
  }

  console.log('[MIGRATION] Found old column avg_service_time. Copying data to duration_minutes…');

  // 2. Copy data from avg_service_time to duration_minutes where duration_minutes is NULL
  const updatedCount = await prisma.$executeRaw`
    UPDATE services 
    SET duration_minutes = avg_service_time 
    WHERE duration_minutes IS NULL AND avg_service_time IS NOT NULL;
  `;

  console.log(`[MIGRATION] Success! Updated ${updatedCount} services with historical duration data.`);
}

main()
  .catch(e => {
    console.error('[MIGRATION] Failed:', e.message);
  })
  .finally(() => prisma.$disconnect());
