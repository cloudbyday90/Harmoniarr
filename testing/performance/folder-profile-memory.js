/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const fields = ['rss', 'heapUsed', 'heapTotal', 'external', 'arrayBuffers'];
export const folderMemoryDelta = (before, after) => Object.fromEntries(fields.map(key => [key, after[key] - before[key]]));
export function parseFolderProfileCgroup(values, version) {
  const number = value => { if (!/^\d+$/u.test(value.trim()) || !Number.isSafeInteger(Number(value))) throw new TypeError('Require finite cgroup counters'); return Number(value); };
  const counters = text => Object.fromEntries(text.trim().split('\n').map(row => { const [key, value] = row.trim().split(/\s+/u); return [key, number(value)]; }));
  if (![1, 2].includes(version)) throw new TypeError('Unsupported cgroup version');
  const limitBytes = number(values[2]);
  const [quota, period] = version === 2 ? values[5].trim().split(' ') : [values[5].trim(), values[6].trim()];
  const events = counters(values[4]);
  if (!Number.isSafeInteger(events.oom_kill)) throw new TypeError('Missing OOM counter');
  return { version, currentPrecision: version === 1 ? 'approximate-v1' : 'cgroup-current', currentBytes: number(values[0]),
    lifetimePeakBytes: number(values[1]), limitBytes, swapMaxBytes: version === 1 ? number(values[3]) - limitBytes : number(values[3]),
    swapLimitDerivedFromCombined: version === 1, events, cpus: number(quota) / number(period), cpu: counters(values[version === 2 ? 6 : 7]) };
}
export async function readFolderProfileCgroup() {
  let current;
  try { current = await readFile('/sys/fs/cgroup/memory.current', 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (current !== undefined) {
    const values = await Promise.all(['memory.peak', 'memory.max', 'memory.swap.max', 'memory.events', 'cpu.max', 'cpu.stat'].map(name => readFile('/sys/fs/cgroup/' + name, 'utf8')));
    return parseFolderProfileCgroup([current, ...values], 2);
  }
  const paths = ['memory/memory.usage_in_bytes', 'memory/memory.max_usage_in_bytes', 'memory/memory.limit_in_bytes', 'memory/memory.memsw.limit_in_bytes',
    'memory/memory.oom_control', 'cpu/cpu.cfs_quota_us', 'cpu/cpu.cfs_period_us', 'cpu/cpu.stat'];
  return parseFolderProfileCgroup(await Promise.all(paths.map(path => readFile('/sys/fs/cgroup/' + path, 'utf8'))), 1);
}
export async function measureFolderProfileWork(work, { observed = true, readMemory = () => process.memoryUsage(), readRss = () => process.memoryUsage.rss(),
  readResource = () => process.resourceUsage(), cpu = previous => process.cpuUsage(previous), now = () => performance.now(), collect = () => globalThis.gc(),
  schedule = setInterval, cancel = clearInterval } = {}) {
  const snapshot = () => { const row = readMemory(); if (fields.some(key => !Number.isSafeInteger(row[key]) || row[key] < 0)) throw new TypeError('Invalid process memory'); return Object.fromEntries(fields.map(key => [key, row[key]])); };
  collect(); const baseline = snapshot(), resourceBefore = readResource();
  let sampledPeakRss = baseline.rss, samples = 0, observerFailed = false, observerFailure;
  const sample = () => {
    try { const rss = readRss(); if (!Number.isSafeInteger(rss) || rss < 0) throw new TypeError('Invalid RSS'); sampledPeakRss = Math.max(sampledPeakRss, rss); samples++; }
    catch (error) { observerFailed = true; observerFailure = error; }
  };
  const timer = observed ? schedule(sample, 5) : null;
  timer?.unref?.(); const cpuBefore = cpu(), started = now();
  let value, failure, failed = false;
  try { value = await work(); } catch (error) { failed = true; failure = error; }
  const elapsedMs = now() - started, cpuMicros = cpu(cpuBefore);
  try { if (timer !== null) cancel(timer); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  if (observerFailed) throw observerFailure;
  sample(); if (observerFailed) throw observerFailure;
  const after = snapshot(), resourceAfter = readResource(); collect(); const afterGc = snapshot();
  return { value, elapsedMs, cpuMicros, observed, intervalMs: observed ? 5 : null, rssSamples: samples, sampledPeakRss,
    baseline, after, afterGc, delta: folderMemoryDelta(baseline, after), retainedDelta: folderMemoryDelta(baseline, afterGc),
    lifetimeMaxRssBeforeBytes: resourceBefore.maxRSS * 1024, lifetimeMaxRssAfterBytes: resourceAfter.maxRSS * 1024 };
}
