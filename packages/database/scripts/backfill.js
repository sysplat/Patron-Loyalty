const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString:
      'postgresql://postgres:VQNivofSODMbUDGykbJgOdXJdKNTQKUd@nozomi.proxy.rlwy.net:32755/railway',
  });

  await client.connect();
  console.log('Connected to QlessQ DB');

  const res = await client.query(`
    SELECT id, name, email, phone 
    FROM customers 
    WHERE org_id = 'b7987bf3-692f-408b-a868-ce1a145bb60e'
  `);

  console.log(`Found ${res.rows.length} customers to sync.`);

  const API_KEY = 'lms_a5a82fc32cd00308b8d408931a5ff02fc5cc840e0bc04dbc263b3023876dde6c';
  const URL =
    'https://pl-api-production-a528.up.railway.app/api/v1/loyalty/integrations/v1/queue-events';

  let successCount = 0;
  let failCount = 0;

  for (const row of res.rows) {
    const payload = {
      event: 'customer.created',
      sourceId: row.id,
      occurredAt: new Date().toISOString(),
      customer: {
        externalId: row.id,
        name: row.name,
        email: row.email || undefined,
        phone: row.phone || undefined,
      },
    };

    try {
      const resp = await fetch(URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Loyalty-Api-Key': API_KEY,
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      if (resp.ok && data.success) {
        successCount++;
      } else {
        console.error(`Failed to sync ${row.id}:`, data);
        failCount++;
      }
    } catch (e) {
      console.error(`Error syncing ${row.id}:`, e.message);
      failCount++;
    }
  }

  console.log(`Sync complete. Success: ${successCount}, Failed: ${failCount}`);
  await client.end();
}

main().catch(console.error);
