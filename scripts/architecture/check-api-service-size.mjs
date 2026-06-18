import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

const serviceBudgets = [
  {
    path: 'packages/api/src/modules/ticket/ticket.service.ts',
    maxLines: 1000,
    reason: 'Final ticket facade cap after bounded-service extraction.',
  },
  {
    path: 'packages/api/src/modules/workbench/workbench.service.ts',
    maxLines: 600,
    reason: 'Final workbench facade cap after bounded-service extraction.',
  },
  {
    path: 'packages/api/src/modules/notification/notification.service.ts',
    maxLines: 1000,
    reason: 'Keep notification dispatch facade under core-domain size budget.',
  },
  {
    path: 'packages/api/src/modules/auth/auth.service.ts',
    maxLines: 1000,
    reason: 'Final auth facade cap after bounded-service extraction.',
  },
  {
    path: 'packages/api/src/modules/appointment/appointment.service.ts',
    maxLines: 1000,
    reason: 'Final appointment facade cap after bounded-service extraction.',
  },
];

const violations = [];

for (const budget of serviceBudgets) {
  const absolutePath = resolve(root, budget.path);
  const content = await readFile(absolutePath, 'utf8');
  const lineCount = content.split('\n').length;

  if (lineCount > budget.maxLines) {
    violations.push({
      ...budget,
      lineCount,
      excess: lineCount - budget.maxLines,
    });
  }
}

if (violations.length > 0) {
  console.error('API service size check failed.');
  for (const violation of violations) {
    console.error(
      `- ${violation.path}: ${violation.lineCount} lines (limit ${violation.maxLines}, +${violation.excess})`,
    );
    console.error(`  ${violation.reason}`);
  }
  process.exit(1);
}

console.log('API service size check passed.');
