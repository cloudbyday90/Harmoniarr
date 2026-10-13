/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { writeFile } from 'node:fs/promises';
import { measureWantedGuardedWorkload } from '../testing/integration/wanted-guarded-benchmark.js';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--output') throw new TypeError('Usage: node --expose-gc scripts/measure-wanted-guarded-workload.js --output <local JSON>');
const samples = []; const controller = new AbortController();
const cancel = () => controller.abort(new Error('Guarded workload measurement cancelled'));
process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
let completed = false;
try {
  await measureWantedGuardedWorkload({ signal: controller.signal, onSample: row => { samples.push(row); },
    onProgress: record => process.stdout.write(`${JSON.stringify({ kind: 'wanted_guarded_progress', ...record })}\n`) });
  completed = true;
} catch { process.exitCode = 1; process.stderr.write('Guarded workload measurement did not complete\n'); }
finally {
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
  await writeFile(args[1], JSON.stringify({ version: 1, kind: 'wanted_guarded_workload', completed, node: process.version, samples }, null, 2));
}
