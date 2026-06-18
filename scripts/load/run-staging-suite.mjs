#!/usr/bin/env node

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const ARTIFACT_DIR = process.env.LOAD_TEST_ARTIFACT_DIR || 'scripts/load/artifacts';

function runNode(script, args = [], env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code ?? -1}`));
    });
    child.on('error', reject);
  });
}

async function latestArtifactForScenario(scenario) {
  const files = await readdir(ARTIFACT_DIR);
  const matches = files
    .filter((name) => name.startsWith(`load-${scenario}-`) && name.endsWith('.json'))
    .sort();
  if (!matches.length) {
    throw new Error(`No artifact found for scenario ${scenario} in ${ARTIFACT_DIR}`);
  }
  return join(ARTIFACT_DIR, matches[matches.length - 1]);
}

async function main() {
  console.log('[load-suite] running issue scenario');
  await runNode('scripts/load/run-ticket-issuance-load.mjs', [], {
    LOAD_TEST_SCENARIO: 'issue',
  });

  console.log('[load-suite] running join scenario');
  await runNode('scripts/load/run-ticket-issuance-load.mjs', [], {
    LOAD_TEST_SCENARIO: 'join',
  });

  const issueArtifact = await latestArtifactForScenario('issue');
  const joinArtifact = await latestArtifactForScenario('join');

  console.log(`[load-suite] verifying ${issueArtifact}`);
  await runNode('scripts/load/verify-load-artifact.mjs', [issueArtifact]);

  console.log(`[load-suite] verifying ${joinArtifact}`);
  await runNode('scripts/load/verify-load-artifact.mjs', [joinArtifact]);
}

main().catch((error) => {
  console.error(`[load-suite] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
