/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createIntegrationTestPlan, discoverIntegrationTestFiles } from '../testing/integration/integration-test-plan.js';
import { runIntegrationTests } from '../testing/integration/integration-test-coordinator.js';

const controller = new AbortController();
// Write callbacks own failure; observe the separate stream error event too.
process.stdout.on('error', () => {}); process.stderr.on('error', () => {});
const cancel = () => controller.abort(new Error('Complete integration run cancelled'));
const write = (stream, line) => new Promise((resolve, reject) => {
  stream.write(line + '\n', error => { if (error) reject(error); else resolve(); });
});
process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
let published = 0;
try {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--plan') {
    const files = await discoverIntegrationTestFiles();
    await write(process.stdout, JSON.stringify({ version: 1, files: files.length, steps: createIntegrationTestPlan(files) }, null, 2));
  } else {
    if (args.length) throw new TypeError('Only the complete integration run or --plan is supported');
    await runIntegrationTests({ signal: controller.signal, onUpdate: async report => {
      for (const outcome of report.outcomes.slice(published)) {
        await write(process.stdout, `[integration-coordinator:file] ${JSON.stringify(outcome)}`); published++;
      }
      await write(process.stdout, `[integration-coordinator] ${JSON.stringify({ version: report.version,
        complete: report.complete, failed: report.failed, files: report.files, completed: report.completed,
        counts: report.counts, durationMs: report.durationMs, ownership: report.ownership,
        prerequisites: report.prerequisites })}`);
    } });
  }
} catch (error) {
  const code = typeof error?.code === 'string' && /^fixture_[a-z_]{1,70}$/u.test(error.code)
    ? error.code : 'fixture_integration_run_failed';
  await write(process.stderr, `[integration-coordinator] ${code}`).catch(() => {});
  process.exitCode = 1;
} finally {
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
}
