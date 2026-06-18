import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const apiDir = path.resolve(repoRoot, 'packages/api/src');
const baselinePath = path.resolve(__dirname, 'tenant-isolation-baseline.json');
const updateBaseline = process.argv.includes('--update-baseline');

const protectedModels = [
  'ticket',
  'customer',
  'queue',
  'visit',
  'desk',
  'service',
  'roleAssignment',
  'appointment',
  'notification',
  'review',
  'notificationTemplate',
  'activityLog',
  'branch',
  'role',
  'user',
  'setting',
  'displayDevice',
  'serviceCategory',
  'announcement',
  'announcementUserState',
  'stationProfile',
  'stationProfileQueue',
  'agentSession',
  'branchFlowTemplate',
  'branchFlowStep',
  'displayTheme',
  'integration',
  'webhookEndpoint',
  'auditLog',
  'supportRequest',
  'supportMessage',
  'subscription',
  'invoice',
  'paymentRecord',
  'smsCreditPurchase',
  'orgHealthSnapshot',
  'fileUpload',
  'onboardingProgress',
  'workingHours',
  'branchDateOverride',
  'branchService',
  'subService',
  'queueRule',
];

function getFilesRecursively(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

function collectViolations() {
  const files = getFilesRecursively(apiDir);
  const violations = [];

  for (const file of files) {
    const relFile = path.relative(repoRoot, file).replaceAll(path.sep, '/');
    if (file.endsWith('.spec.ts') || file.includes('/prisma/') || relFile.endsWith('check-db.ts')) {
      continue;
    }

    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const model of protectedModels) {
        const unsafePattern = new RegExp(`(?:this\\.)?prisma\\.${model}\\.`, 'g');
        if (!unsafePattern.test(line)) continue;

        if (
          lines[Math.max(0, i - 1)].includes('eslint-disable-next-line security/tenant-isolation') ||
          line.includes('// bypass-tenant-isolation')
        ) {
          continue;
        }

        const lineText = line.trim();
        const signature = `${model}|${relFile}|${lineText}`;
        violations.push({
          signature,
          file: relFile,
          line: i + 1,
          model,
          lineText,
        });
      }
    }
  }

  return violations;
}

function readBaselineSignatures() {
  if (!fs.existsSync(baselinePath)) return new Set();
  const raw = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const items = Array.isArray(raw?.violations) ? raw.violations : [];
  return new Set(items.filter((v) => typeof v === 'string'));
}

function writeBaseline(signatures) {
  const sorted = [...signatures].sort((a, b) => a.localeCompare(b));
  const payload = {
    generatedAt: new Date().toISOString(),
    protectedModels,
    violations: sorted,
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function runCheck() {
  const violations = collectViolations();
  const currentSignatures = new Set(violations.map((v) => v.signature));

  if (updateBaseline) {
    writeBaseline(currentSignatures);
    console.log(`✅ Tenant isolation baseline updated (${currentSignatures.size} entries).`);
    return;
  }

  const baselineSignatures = readBaselineSignatures();
  const newViolations = violations.filter((v) => !baselineSignatures.has(v.signature));

  if (newViolations.length > 0) {
    for (const violation of newViolations) {
      console.error(
        `[TENANT ISOLATION ERROR] Unsafe access to protected model '${violation.model}'`,
      );
      console.error(`File: ${violation.file}:${violation.line}`);
      console.error(`Line: ${violation.lineText}`);
      console.error(
        `Reason: Must use 'tx.${violation.model}' inside PrismaService.withTenant()/withBypassRls.\n`,
      );
    }
    console.error(
      `Tenant isolation check failed with ${newViolations.length} new violation(s). ` +
        `If this is an intentional baseline refresh, run: node scripts/security/check-tenant-isolation.mjs --update-baseline`,
    );
    process.exit(1);
  }

  console.log(
    `✅ Tenant isolation check passed (baseline mode). Tracked violations: ${currentSignatures.size}.`,
  );
}

runCheck();
