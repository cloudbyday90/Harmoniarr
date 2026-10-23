/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { readFile } from 'node:fs/promises';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

const processFields = ['rss', 'heapUsed', 'external', 'arrayBuffers'];
const statFields = ['anon', 'file', 'kernel', 'shmem'];
const eventFields = ['max', 'oom', 'oom_kill'];
function integer(value) {
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value))) throw new TypeError('Unavailable finite memory evidence');
  return Number(value);
}
function project(text, fields) {
  const rows = text.trim().split('\n').map(row => row.trim().split(/\s+/u));
  const result = {};
  for (const key of fields) {
    const matches = rows.filter(row => row[0] === key);
    if (matches.length !== 1 || matches[0].length !== 2) throw new TypeError('Unavailable memory counter');
    result[key] = integer(matches[0][1]);
  }
  return result;
}
export function parseDeploymentMemory({ current, peak, limit, stat, events, failcnt, version = 2 }) {
  const limitBytes = integer(limit.trim());
  if (limitBytes < 1) throw new TypeError('Require a finite memory limit');
  if (![1, 2].includes(version)) throw new TypeError('Unsupported cgroup version');
  return { version, usagePrecision: version === 1 ? 'approximate-v1' : 'cgroup-current',
    currentBytes: integer(current.trim()), lifetimePeakBytes: integer(peak.trim()), limitBytes,
    categories: project(stat, version === 1 ? ['total_rss', 'total_cache', 'total_mapped_file'] : statFields),
    events: version === 1 ? { max: integer(failcnt.trim()), oom: null, ...project(events, ['oom_kill']) } : project(events, eventFields) };
}
export async function readDeploymentMemory() {
  let current;
  try { current = await readFile('/sys/fs/cgroup/memory.current', 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (current !== undefined) {
    const values = await Promise.all(['peak', 'max', 'stat', 'events'].map(name => readFile(`/sys/fs/cgroup/memory.${name}`, 'utf8')));
    return parseDeploymentMemory({ current, peak: values[0], limit: values[1], stat: values[2], events: values[3] });
  }
  const values = await Promise.all(['usage_in_bytes', 'max_usage_in_bytes', 'limit_in_bytes', 'stat', 'oom_control', 'failcnt']
    .map(name => readFile(`/sys/fs/cgroup/memory/memory.${name}`, 'utf8')));
  return parseDeploymentMemory({ current: values[0], peak: values[1], limit: values[2], stat: values[3], events: values[4], failcnt: values[5], version: 1 });
}

/** Numeric observations only. Categories/fields overlap and must not be added. */
export async function measureDeploymentMemory(work, { readKernel = readDeploymentMemory,
  readProcess = () => process.memoryUsage(), intervalMs = 25 } = {}) {
  if (typeof work !== 'function' || !Number.isInteger(intervalMs) || intervalMs < 5) throw new TypeError('Invalid memory measurement');
  const checkpoints = {}; const processPeaks = {}; let samples = 0; let sampledCurrentPeakBytes = 0;
  let pending; let failed = false; let failure; let timer; let open = true; let checkpointBusy = false;
  const take = async label => {
    const kernel = await readKernel(); const memory = readProcess();
    for (const key of processFields) {
      if (!Number.isSafeInteger(memory[key]) || memory[key] < 0) throw new TypeError('Unavailable process memory evidence');
      processPeaks[key] = Math.max(processPeaks[key] ?? 0, memory[key]);
    }
    samples++; sampledCurrentPeakBytes = Math.max(sampledCurrentPeakBytes, kernel.currentBytes);
    const row = { kernel, process: Object.fromEntries(processFields.map(key => [key, memory[key]])) };
    if (label) checkpoints[label] = row;
    return row;
  };
  const checkpoint = async label => {
    if (!open || checkpointBusy || !['baseline', 'admitted', 'publication', 'settled'].includes(label)
      || Object.hasOwn(checkpoints, label)) throw new TypeError('Invalid memory checkpoint');
    checkpointBusy = true;
    try {
      await pending;
      if (failed) throw failure;
      pending = take(label);
      try { return await pending; } finally { pending = null; }
    } finally { checkpointBusy = false; }
  };
  return withWorkerTaskCleanup(async () => {
    await checkpoint('baseline');
    timer = setInterval(() => {
      if (pending || failed || checkpointBusy) return;
      pending = take().catch(error => { failed = true; failure = error; }).finally(() => { pending = null; });
    }, intervalMs);
    const result = await work(checkpoint);
    clearInterval(timer); await pending;
    if (failed) throw failure;
    await checkpoint('settled');
    return { result, checkpoints, samples, sampledCurrentPeakBytes, processPeaks };
  }, async () => { open = false; clearInterval(timer); await pending; if (failed) throw failure; });
}
