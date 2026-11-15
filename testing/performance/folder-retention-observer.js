/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { setTimeout, setImmediate } from 'node:timers/promises';
import { createFolderRetentionSession } from './folder-retention-session.js';
import { readFolderProfileCgroup } from './folder-profile-memory.js';
import { folderRetentionPolicy, folderRetentionModes, folderRetentionMemoryFields, summarizeFolderRetention } from './folder-retention-policy.js';

/** No interval, page retention or heap snapshot. GC is opt-in in a separate process. */
export async function observeFolderRetention(options, {
  createSession = createFolderRetentionSession, readMemory = () => process.memoryUsage(),
  readFds = async () => (await readdir('/proc/self/fd')).length,
  readResources = () => process.getActiveResourcesInfo(), readCgroup = readFolderProfileCgroup,
  collect = () => globalThis.gc(), idle = async () => { await setTimeout(folderRetentionPolicy.idleMs); await setImmediate(); },
  afterAuxiliaryReads = () => setImmediate(), onCheckpoint = async () => {}, now = () => performance.now(),
} = {}) {
  assert.ok(folderRetentionModes.includes(options.mode));
  const session = createSession(options), checkpoints = [], cycles = [];
  async function snapshot(afterCycle) {
    await idle();
    const state = session.idleState(); assert.deepEqual(state, { liveHandles: 0, waveActive: false });
    // Auxiliary file reads complete before memory/resource sampling. Never emit fd targets.
    const cgroup = await readCgroup(), fdCount = await readFds();
    if (options.mode === 'forced-gc') collect();
    await afterAuxiliaryReads();
    const raw = readMemory(), memory = Object.fromEntries(folderRetentionMemoryFields.map(field => [field, raw[field]]));
    for (const value of Object.values(memory)) assert.ok(Number.isSafeInteger(value) && value >= 0, 'Invalid idle memory sample');
    const resources = {};
    for (const type of readResources()) resources[type] = (resources[type] ?? 0) + 1;
    checkpoints.push({ afterCycle, memory, cgroup, fdCount, resources, ...state });
    // Acknowledged bounded output is outside the sampled work and completes before the next cycle.
    await onCheckpoint({ checkpoint: checkpoints.at(-1), cycle: cycles.at(-1) ?? null });
  }
  await snapshot(0);
  const started = now();
  for (let index = 0; index < folderRetentionPolicy.warmupCycles + folderRetentionPolicy.measuredCycles; index++) {
    // cycle() returns only numbers and a digest; its task/page scope has fully returned.
    cycles.push({ cycle: index + 1, ...await session.cycle() }); await snapshot(index + 1);
  }
  const report = { mode: options.mode, bufferSize: 128, serviceInstances: 1, idleMs: folderRetentionPolicy.idleMs,
    readAbortBoundary: 'native-read-dispatched-delivery-held', closeAbortBoundary: 'before-native-close-dispatch',
    elapsedMs: now() - started, cycles, checkpoints };
  const result = { ...report, analysis: summarizeFolderRetention(report) };
  assert.ok(Buffer.byteLength(JSON.stringify(result)) <= folderRetentionPolicy.maxReportBytes, 'Retention report exceeds fixed bound');
  return result;
}
