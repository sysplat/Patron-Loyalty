import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function getDirSizeBytes(path) {
  let total = 0;
  const stack = [path];
  while (stack.length) {
    const current = stack.pop();
    const stat = statSync(current, { throwIfNoEntry: false });
    if (!stat) continue;
    if (stat.isDirectory()) {
      const children = readdirSync(current);
      for (const child of children) stack.push(join(current, child));
    } else {
      total += stat.size;
    }
  }
  return total;
}

function parseBudgetKb(value, fallbackKb) {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackKb;
  return parsed;
}

const webLimitKb = parseBudgetKb(process.env.WEB_BUNDLE_BUDGET_KB, 12000);
const adminLimitKb = parseBudgetKb(process.env.ADMIN_BUNDLE_BUDGET_KB, 12000);

const webBytes = getDirSizeBytes(join(process.cwd(), 'apps/web/.next/static/chunks'));
const adminBytes = getDirSizeBytes(join(process.cwd(), 'apps/admin/.next/static/chunks'));
const webKb = Math.ceil(webBytes / 1024);
const adminKb = Math.ceil(adminBytes / 1024);

console.log(`web chunks size: ${webKb} KB (budget ${webLimitKb} KB)`);
console.log(`admin chunks size: ${adminKb} KB (budget ${adminLimitKb} KB)`);

const failures = [];
if (webKb > webLimitKb) failures.push(`web exceeded bundle budget by ${webKb - webLimitKb} KB`);
if (adminKb > adminLimitKb) failures.push(`admin exceeded bundle budget by ${adminKb - adminLimitKb} KB`);

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
