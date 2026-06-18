import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();

const legalFiles = [
  'packages/shared/src/constants/legal.ts',
  'apps/web/src/content/legal/privacy-policy.ts',
  'apps/web/src/content/legal/terms-of-service.ts',
  'apps/web/src/content/legal/patron-privacy.ts',
  'apps/web/src/content/legal/patron-terms.ts',
  'apps/web/src/content/legal/dpa-overview.ts',
  'apps/web/src/content/legal/subprocessors.ts',
  'apps/loyalty/src/content/legal/loyalty-terms.ts',
  'apps/loyalty/src/content/legal/loyalty-privacy.ts',
  'apps/loyalty/src/content/legal/loyalty-patron-terms.ts',
  'apps/loyalty/src/content/legal/loyalty-patron-privacy.ts',
];

const blockedPatterns = [
  /Counsel review recommended/i,
  /\[Update [^\]]+\]/i,
  /Replace with counsel-approved/i,
  /TODO_LEGAL/i,
  /TBD_LEGAL/i,
];

async function main() {
  const failures = [];

  for (const relPath of legalFiles) {
    const absolutePath = path.join(repoRoot, relPath);
    const text = await fs.readFile(absolutePath, 'utf8');
    for (const pattern of blockedPatterns) {
      if (pattern.test(text)) {
        failures.push({ relPath, pattern: pattern.toString() });
      }
    }
  }

  if (failures.length > 0) {
    console.error('Legal placeholder check failed:');
    for (const failure of failures) {
      console.error(`- ${failure.relPath} matched ${failure.pattern}`);
    }
    process.exit(1);
  }

  console.log('Legal placeholder check passed.');
}

main().catch((error) => {
  console.error('Failed to run legal placeholder check:', error);
  process.exit(1);
});
