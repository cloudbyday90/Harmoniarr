/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';

export const folderRetentionPolicy = Object.freeze({ warmupCycles: 3, measuredCycles: 12, idleMs: 50, timeoutMs: 600_000, maxReportBytes: 128 * 1024 });
export const folderRetentionModes = Object.freeze(['natural', 'forced-gc']);
export const folderRetentionMemoryFields = Object.freeze(['rss', 'heapUsed', 'heapTotal', 'external', 'arrayBuffers']);

export function createFolderRetentionPlan() {
  return folderRetentionModes.map(mode => ({ caseName: 'long-ceiling', mode }));
}

/** Finite descriptive evidence, not an automatic leak/plateau classifier. */
export function summarizeFolderRetention(report) {
  const { warmupCycles, measuredCycles, maxReportBytes } = folderRetentionPolicy;
  assert.ok(folderRetentionModes.includes(report.mode));
  assert.equal(report.bufferSize, 128); assert.equal(report.serviceInstances, 1);
  assert.equal(report.idleMs, folderRetentionPolicy.idleMs); assert.ok(Number.isFinite(report.elapsedMs) && report.elapsedMs >= 0);
  assert.equal(report.cycles.length, warmupCycles + measuredCycles);
  assert.equal(report.checkpoints.length, report.cycles.length + 1);
  for (const [index, cycle] of report.cycles.entries()) {
    assert.equal(cycle.cycle, index + 1); assert.equal(cycle.publishedScans, 6); assert.equal(cycle.abortedScans, 2);
    assert.equal(cycle.busyRefusals, 3); assert.match(cycle.digest, /^[a-f0-9]{64}$/u);
    assert.equal(cycle.digest, report.cycles[0].digest);
    assert.equal(cycle.counts.directoryOpens, 8); assert.equal(cycle.counts.directoryCloses, 8);
    assert.equal(cycle.counts.closeDispatches, 8); assert.equal(cycle.counts.liveHandles, 0);
    assert.equal(cycle.counts.peakHandles, 4); assert.equal(cycle.counts.directoryReads, 350_008);
    assert.equal(cycle.counts.stats, 15); assert.equal(cycle.counts.bufferChecks, 8);
  }
  const baselineFdCount = report.checkpoints[0].fdCount;
  for (const [index, row] of report.checkpoints.entries()) {
    assert.equal(row.afterCycle, index); assert.equal(row.liveHandles, 0); assert.equal(row.waveActive, false);
    assert.equal(row.fdCount, baselineFdCount); assert.ok(Number.isSafeInteger(row.fdCount) && row.fdCount > 0);
    for (const field of folderRetentionMemoryFields) assert.ok(Number.isSafeInteger(row.memory[field]) && row.memory[field] >= 0);
    assert.equal(row.cgroup.limitBytes, 1024 ** 3); assert.equal(row.cgroup.swapMaxBytes, 0); assert.equal(row.cgroup.cpus, 2);
    for (const field of ['currentBytes', 'lifetimePeakBytes']) assert.ok(Number.isSafeInteger(row.cgroup[field]) && row.cgroup[field] >= 0);
    assert.ok(Number.isSafeInteger(row.cgroup.events.oom_kill) && row.cgroup.events.oom_kill >= 0);
    assert.equal(row.cgroup.events.oom_kill, report.checkpoints[0].cgroup.events.oom_kill);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(report)) <= maxReportBytes, 'Retention report exceeds fixed bound');
  const rows = report.checkpoints.slice(warmupCycles), first = rows[0], last = rows.at(-1);
  const fields = Object.fromEntries(folderRetentionMemoryFields.map(field => {
    const values = rows.map(row => row.memory[field]);
    return [field, { start: values[0], end: values.at(-1), min: Math.min(...values), max: Math.max(...values),
      change: last.memory[field] - first.memory[field], changePerCycle: (last.memory[field] - first.memory[field]) / measuredCycles }];
  }));
  return { scope: 'finite-idle-observations-no-leak-free-claim', warmupCycles, measuredCycles, fields,
    fdCount: baselineFdCount, completedScans: report.cycles.length * 6, abortedScans: report.cycles.length * 2,
    cgroupCurrentChangeBytes: last.cgroup.currentBytes - first.cgroup.currentBytes,
    containerLifetimePeakBytes: last.cgroup.lifetimePeakBytes };
}
