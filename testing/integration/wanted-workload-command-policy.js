/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
const modes = new Map([
  ['--source-noops', ['wanted_source_noops', 'sourceTransitionMode', ['compatibility', 'locked-noop']]],
  ['--distinct-bindings', ['wanted_distinct_bindings', 'rootReadMode', ['member', 'bounded']]],
  ['--bounded-roots', ['wanted_bounded_roots', 'rootReadMode', ['member', 'bounded']]],
  ['--receipt-groups', ['wanted_closed_receipt_groups', 'receiptGrouping', [false, true]]],
  ['--root-costs', ['wanted_root_costs', 'costDiagnostics', [false, true]]],
  ['', ['wanted_guarded_workload', 'readMethod', ['stream', 'reusable']]],
]);
const usage = 'Usage: node --expose-gc scripts/measure-wanted-guarded-workload.js --output <local JSON> [--source-noops|--distinct-bindings|--bounded-roots|--receipt-groups|--root-costs] [--profiles sine,noise] [--bindings 2,4,8] [--pairs 1|2]';
const invalid = () => new TypeError(usage);

function list(value, allowed) {
  if (typeof value !== 'string') throw invalid();
  const items = value.split(',');
  if (!items.length || items.some(item => !allowed.includes(item)) || new Set(items).size !== items.length) throw invalid();
  return items;
}

/** Explicit selection never changes the reviewed fixture limits or full default. */
export function parseWantedWorkloadCommand(args) {
  if (!Array.isArray(args) || args.some(arg => typeof arg !== 'string')) throw invalid();
  const values = new Map(); let mode = '';
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg && modes.has(arg)) {
      if (mode) throw invalid();
      mode = arg;
    } else {
      if (!['--output', '--profiles', '--bindings', '--pairs'].includes(arg) || values.has(arg)
        || !args[i + 1] || args[i + 1].startsWith('--')) throw invalid();
      values.set(arg, args[++i]);
    }
  }
  if (!values.has('--output') || !values.get('--output').trim()) throw invalid();
  const distinct = ['--source-noops', '--distinct-bindings'].includes(mode);
  if (!distinct && values.has('--bindings')) throw invalid();
  const profiles = Object.freeze(list(values.get('--profiles') ?? 'sine,noise', ['sine', 'noise']));
  const bindingCounts = Object.freeze(list(values.get('--bindings') ?? '2,4,8', ['2', '4', '8']).map(Number));
  const pairs = values.get('--pairs') ?? '2';
  if (!['1', '2'].includes(pairs)) throw invalid();
  const dimensions = distinct ? { bindingCounts } : { receiptCounts: Object.freeze([16, 48, 96]) };
  const scope = profiles.join(',') === 'sine,noise' && (!distinct || bindingCounts.join(',') === '2,4,8') && pairs === '2'
    ? 'full' : 'selected';
  const [kind, variantField, variants] = modes.get(mode);
  const plan = Object.freeze({ scope, profiles, ...dimensions, pairs: Number(pairs),
    expectedSamples: profiles.length * (distinct ? bindingCounts.length : 3) * Number(pairs) * 2 });
  const options = Object.freeze({ profiles, ...dimensions, pairs: Number(pairs),
    ...(distinct ? mode === '--source-noops' ? { sourceNoopComparison: true } : {}
      : { groupingComparison: mode === '--receipt-groups', rootCostComparison: mode === '--root-costs', boundedRootComparison: mode === '--bounded-roots' }) });
  return Object.freeze({ output: values.get('--output'), kind, distinct, plan, options,
    variantField, variants: Object.freeze([...variants]) });
}

export function wantedWorkloadSampleKey(selection, row) {
  return JSON.stringify([row.mediaProfile, selection.distinct ? row.bindings : row.receipts, row.pair, row[selection.variantField]]);
}

export function wantedWorkloadExpectedKeys(selection) {
  const { profiles, bindingCounts, receiptCounts, pairs } = selection.plan;
  const keys = new Set();
  for (const mediaProfile of profiles) for (const dimension of bindingCounts ?? receiptCounts) {
    for (let pair = 0; pair < pairs; pair++) for (const variant of selection.variants) {
      keys.add(JSON.stringify([mediaProfile, dimension, pair, variant]));
    }
  }
  return keys;
}
