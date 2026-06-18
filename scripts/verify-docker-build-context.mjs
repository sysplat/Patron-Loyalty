#!/usr/bin/env node
/**
 * Ensures Next.js app Dockerfiles COPY every repo-root script that next.config.js requires.
 * Catches CI/Railway failures like "Cannot find module '../../scripts/load-monorepo-env.cjs'".
 *
 * Run: pnpm check:docker-build-context
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const NEXT_APPS = [
  { appDir: 'apps/web', dockerfile: 'apps/web/Dockerfile' },
  { appDir: 'apps/admin', dockerfile: 'apps/admin/Dockerfile' },
  { appDir: 'apps/loyalty', dockerfile: 'railway/docker/loyalty.Dockerfile' },
];

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function requiredScriptsFromNextConfig(appDir) {
  const configPath = path.join(root, appDir, 'next.config.js');
  const src = fs.readFileSync(configPath, 'utf8');
  const required = new Set();
  const re = /require\(['"](\.\.\/\.\.\/scripts\/[^'"]+)['"]\)/g;
  for (const match of src.matchAll(re)) {
    required.add(match[1].replace(/^\.\.\/\.\.\//, ''));
  }
  return [...required].sort();
}

function copiedPathsFromDockerfile(dockerfileRel) {
  const src = read(dockerfileRel);
  const copied = new Set();
  for (const line of src.split('\n')) {
    const m = line.match(/^\s*COPY\s+(\S+)\s+/);
    if (m) copied.add(m[1]);
  }
  return copied;
}

function dockerfileCopiesScript(dockerfileRel, scriptRel) {
  const src = read(dockerfileRel);
  const dest = `scripts/${path.basename(scriptRel)}`;
  return src.includes(`COPY ${scriptRel} ${dest}`) || src.includes(`COPY ${scriptRel} `);
}

let failed = false;

for (const { appDir, dockerfile } of NEXT_APPS) {
  const required = requiredScriptsFromNextConfig(appDir);
  if (required.length === 0) {
    console.warn(`⚠ ${appDir}/next.config.js: no ../../scripts/* requires found — update verify script?`);
    continue;
  }

  for (const scriptRel of required) {
    const abs = path.join(root, scriptRel);
    if (!fs.existsSync(abs)) {
      console.error(`✗ ${scriptRel} is required by ${appDir} but missing from repo`);
      failed = true;
      continue;
    }
    if (!dockerfileCopiesScript(dockerfile, scriptRel)) {
      console.error(
        `✗ ${dockerfile} must COPY ${scriptRel} (required by ${appDir}/next.config.js)`,
      );
      failed = true;
      continue;
    }
    console.log(`✓ ${dockerfile} copies ${scriptRel}`);
  }
}

if (failed) {
  console.error('\nDocker build context check failed. See docs/deployment/DEPLOYMENT_CI_AND_DOCKER.md');
  process.exit(1);
}

console.log('\n✅ Docker build context checks passed.');
