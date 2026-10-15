/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { finished } from 'node:stream/promises';
import { promisify } from 'node:util';
import { createPostgresCohortEnvironment } from '../testing/integration/postgres-cohort-policy.js';
import { comparePostgresCohort } from '../testing/integration/postgres-cohort-comparison.js';
import { withWorkerTaskCleanup } from '../src/server/worker-task-cleanup.js';

if (process.argv.length !== 2) throw new TypeError('The complete cohort comparison accepts no selection arguments');
const env = createPostgresCohortEnvironment(); const executeFile = promisify(execFile);
const controller = new AbortController(); const cancel = () => controller.abort(new Error('Cohort comparison cancelled'));
process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
let directory; let latest;
try {
  for (const image of [env.HARMONIARR_INTEGRATION_POSTGRES_IMAGE, env.HARMONIARR_INTEGRATION_MEDIA_IMAGE]) {
    if (controller.signal.aborted) throw controller.signal.reason;
    const { stdout } = await executeFile('docker', ['image', 'inspect', image, '--format', '{{.Id}} {{.Os}}'],
      { timeout: 30_000, windowsHide: true });
    if (stdout.trim() !== `${image} linux`) throw new Error('Cohort image identity was not verified');
  }
  const tools = [];
  for (const binary of ['ffmpeg', 'ffprobe']) {
    if (controller.signal.aborted) throw controller.signal.reason;
    const { stdout } = await executeFile('docker', ['run', '--rm', '--network', 'none', '--entrypoint', binary,
      env.HARMONIARR_INTEGRATION_MEDIA_IMAGE, '-version'], { timeout: 30_000, maxBuffer: 64 * 1024, windowsHide: true });
    tools.push(stdout.split('\n')[0].trim());
  }
  if (controller.signal.aborted) throw controller.signal.reason;
  await mkdir('.tmp', { recursive: true }); directory = await mkdtemp(join('.tmp', 'postgres-cohort-comparison-'));
  const log = createWriteStream(join(directory, 'native.log'), { flags: 'wx', mode: 0o600 });
  log.on('error', () => {});
  console.log(`[postgres-cohort] artifacts: ${directory}`);
  await withWorkerTaskCleanup(() => comparePostgresCohort({ env, signal: controller.signal, stdout: log, stderr: log,
    onUpdate: async report => {
      latest = { ...report, runtime: process.version,
        postgresImage: env.HARMONIARR_INTEGRATION_POSTGRES_IMAGE, mediaImage: env.HARMONIARR_INTEGRATION_MEDIA_IMAGE, tools };
      await writeFile(join(directory, 'report.json'), JSON.stringify(latest, null, 2), { mode: 0o600 });
      console.log(`[postgres-cohort] ${JSON.stringify({ complete: report.complete, failed: report.failed === true,
        completedSamples: report.samples.length, ...(report.complete ? { pairs: report.pairs } : {}) })}`);
    } }), async () => { log.end(); await finished(log); });
} catch {
  if (latest) {
    latest.complete = false; latest.failed = true; delete latest.pairs;
    await writeFile(join(directory, 'report.json'), JSON.stringify(latest, null, 2), { mode: 0o600 }).catch(() => {});
  }
  console.error('[postgres-cohort] comparison failed; partial evidence retained'); process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
}
