/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const executeFile = promisify(execFile);
export const postgresCohortPlan = Object.freeze([
  Object.freeze({ mode: 'isolated', order: 'forward' }), Object.freeze({ mode: 'shared', order: 'forward' }),
  Object.freeze({ mode: 'shared', order: 'reverse' }), Object.freeze({ mode: 'isolated', order: 'reverse' }),
]);
export function createPostgresCohortEnvironment(env = process.env) {
  const postgresImage = env.HARMONIARR_INTEGRATION_POSTGRES_IMAGE; const mediaImage = env.HARMONIARR_INTEGRATION_MEDIA_IMAGE;
  if (![postgresImage, mediaImage].every(value => /^sha256:[a-f0-9]{64}$/u.test(value ?? ''))) {
    throw new TypeError('Cohort comparison requires immutable PostgreSQL and media image IDs');
  }
  const result = { ...env };
  for (const key of Object.keys(result)) {
    if (/^(?:PG|POSTGRES_|HARMONIARR_TEST_PG_|HARMONIARR_INTEGRATION_)/u.test(key)
      || ['NODE_OPTIONS', 'NODE_TEST_CONTEXT'].includes(key)) delete result[key];
  }
  return { ...result, HARMONIARR_INTEGRATION_POSTGRES_IMAGE: postgresImage, HARMONIARR_INTEGRATION_MEDIA_IMAGE: mediaImage,
    HARMONIARR_INTEGRATION_PHASE_TIMINGS: '1', HARMONIARR_INTEGRATION_USE_CONTAINER_REUSE: 'false', TESTCONTAINERS_REUSE_ENABLE: 'false' };
}
/** Current bytes, including unignored new code. Hashing is outside measured profile work. */
export async function fingerprintPostgresCohortSource(cwd = process.cwd()) {
  const { stdout } = await executeFile('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--',
    '*.js', '*.json', '*.sql', '*.vue', '*.css', '*.yaml', '*.yml', '*Dockerfile*'],
  { cwd, timeout: 30_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
  const files = [...new Set(stdout.split('\0').filter(Boolean))].sort(); const hash = createHash('sha256');
  if (!files.length) throw new Error('Cohort comparison requires repository source');
  for (const file of files) hash.update(JSON.stringify([file, createHash('sha256').update(await readFile(resolve(cwd, file))).digest('hex')]) + '\n');
  return { files: files.length, sha256: hash.digest('hex') };
}
