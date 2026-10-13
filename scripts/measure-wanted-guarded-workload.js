/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { writeFile } from 'node:fs/promises';
import { parseWantedWorkloadCommand } from '../testing/integration/wanted-workload-command-policy.js';
import { runWantedWorkloadMeasurement } from '../testing/integration/wanted-workload-runner.js';

const selection = parseWantedWorkloadCommand(process.argv.slice(2));
const controller = new AbortController();
const measure = async input => {
  if (typeof global.gc !== 'function') throw new TypeError('Guarded workload measurement requires explicit GC');
  if (selection.distinct) {
    const { measureWantedDistinctBindings } = await import('../testing/integration/wanted-distinct-binding-benchmark.js');
    return measureWantedDistinctBindings(input);
  }
  const { measureWantedGuardedWorkload } = await import('../testing/integration/wanted-guarded-benchmark.js');
  return measureWantedGuardedWorkload(input);
};
const cancel = () => controller.abort(new Error('Guarded workload measurement cancelled'));
process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
try {
  const result = await runWantedWorkloadMeasurement({ selection,
    measure,
    signal: controller.signal,
    onProgress: record => process.stdout.write(`${JSON.stringify({ kind: 'wanted_guarded_progress', ...record })}\n`) });
  if (result.failed) {
    process.exitCode = 1;
    process.stderr.write(`[wanted-workload-failure] ${JSON.stringify({ ...result.report.failure,
      lastCheckpoint: result.report.lastCheckpoint, completedSamples: result.report.samples.length })}\n`);
  }
  await writeFile(selection.output, JSON.stringify(result.report, null, 2));
} finally {
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
}
