import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRANSACTIONAL_SMS_TEMPLATE_TYPES = ['ticket_created', 'ticket_called', 'ticket_recalled'];

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const orgArg = process.argv.find((arg) => arg.startsWith('--org='));
const orgId = orgArg ? orgArg.split('=')[1] : null;
const batchSize = 200;

function hasLegacySmsComplianceSuffix(body) {
  const upper = body.toUpperCase();
  return (
    upper.includes('REPLY STOP') ||
    upper.includes('MSG&DATA RATES') ||
    upper.includes('QUEUEPLATFORM ALERTS') ||
    upper.includes('ALERTS VIA QUEUEPLATFORM') ||
    upper.includes('QLESSQ ALERTS') ||
    upper.includes('ALERTS VIA QLESSQ') ||
    upper.includes('QLEESQ ALERTS') ||
    upper.includes('ALERTS VIA QLEESQ')
  );
}

function stripLegacySmsComplianceSuffix(body) {
  let result = body.trim();
  if (!result) return result;
  if (!hasLegacySmsComplianceSuffix(result)) return result;

  result = result.replace(/\s*alerts via (?:QueuePlatform|QlessQ|QleesQ)\.?\s*/gi, ' ');
  result = result.replace(/\s*(?:QueuePlatform|QlessQ|QleesQ) alerts\.?\s*/gi, ' ');
  result = result.replace(/\s*Msg&data rates may apply\.?\s*/gi, ' ');
  result = result.replace(/\s*Reply STOP to opt out(?:,\s*HELP for help)?\.?\s*$/gi, '');
  return result.trim();
}

async function main() {
  console.log(
    `[legacy-sms-templates] mode=${apply ? 'APPLY' : 'DRY_RUN'}${orgId ? ` org=${orgId}` : ''}`,
  );

  let cursor = null;
  let scannedTemplates = 0;
  let legacyTemplates = 0;
  let updatedTemplates = 0;

  while (true) {
    const templates = await prisma.notificationTemplate.findMany({
      where: {
        channel: 'sms',
        type: { in: TRANSACTIONAL_SMS_TEMPLATE_TYPES },
        ...(orgId ? { orgId } : {}),
      },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true,
        orgId: true,
        type: true,
        body: true,
      },
    });

    if (templates.length === 0) break;
    cursor = templates[templates.length - 1].id;
    scannedTemplates += templates.length;

    for (const template of templates) {
      const currentBody = template.body?.trim() ?? '';
      if (!currentBody || !hasLegacySmsComplianceSuffix(currentBody)) continue;

      const nextBody = stripLegacySmsComplianceSuffix(currentBody);
      if (nextBody === currentBody) continue;

      legacyTemplates += 1;
      console.log(
        `[legacy-sms-templates] ${template.orgId} ${template.type} ${template.id}: strip legacy footer`,
      );

      if (!apply) continue;

      await prisma.notificationTemplate.update({
        where: { id: template.id },
        data: { body: nextBody },
      });
      updatedTemplates += 1;
    }
  }

  console.log('[legacy-sms-templates] completed');
  console.log(
    JSON.stringify(
      {
        mode: apply ? 'APPLY' : 'DRY_RUN',
        orgId,
        scannedTemplates,
        legacyTemplates,
        updatedTemplates,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error('[legacy-sms-templates] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
