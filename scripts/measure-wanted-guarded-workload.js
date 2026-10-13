/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { writeFile } from 'node:fs/promises';
import { measureWantedGuardedWorkload } from '../testing/integration/wanted-guarded-benchmark.js';
import { measureWantedDistinctBindings } from '../testing/integration/wanted-distinct-binding-benchmark.js';

const args = process.argv.slice(2);
if (![2, 3].includes(args.length) || args[0] !== '--output' || !args[1]
  || (args.length === 3 && !['--receipt-groups', '--root-costs', '--bounded-roots', '--distinct-bindings', '--source-noops'].includes(args[2]))) {
  throw new TypeError('Usage: node --expose-gc scripts/measure-wanted-guarded-workload.js --output <local JSON> [--receipt-groups|--root-costs|--bounded-roots|--distinct-bindings|--source-noops]');
}
const groupingComparison = args[2] === '--receipt-groups'; const rootCostComparison = args[2] === '--root-costs';
const boundedRootComparison = args[2] === '--bounded-roots';
const distinctBindings = args[2] === '--distinct-bindings';
const sourceNoopComparison = args[2] === '--source-noops';
const samples = []; const controller = new AbortController();
const cancel = () => controller.abort(new Error('Guarded workload measurement cancelled'));
process.on('SIGINT', cancel); process.on('SIGTERM', cancel);
let completed = false;
try {
  const measure = distinctBindings || sourceNoopComparison ? measureWantedDistinctBindings : measureWantedGuardedWorkload;
  await measure({ ...(sourceNoopComparison ? { sourceNoopComparison } : distinctBindings ? {} : { groupingComparison, rootCostComparison, boundedRootComparison }),
    signal: controller.signal, onSample: row => { samples.push(row); },
    onProgress: record => process.stdout.write(`${JSON.stringify({ kind: 'wanted_guarded_progress', ...record })}\n`) });
  completed = true;
} catch { process.exitCode = 1; process.stderr.write('Guarded workload measurement did not complete\n'); }
finally {
  process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
  await writeFile(args[1], JSON.stringify({ version: 1, kind: sourceNoopComparison ? 'wanted_source_noops' : distinctBindings ? 'wanted_distinct_bindings'
    : boundedRootComparison ? 'wanted_bounded_roots' : rootCostComparison ? 'wanted_root_costs'
    : groupingComparison ? 'wanted_closed_receipt_groups' : 'wanted_guarded_workload',
    completed, node: process.version, samples }, null, 2));
}
