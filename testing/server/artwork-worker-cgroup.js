/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

/** Test-only kernel evidence; unavailable controls refuse qualification. */
export async function artworkWorkerCgroup({ memoryBytes, cpus, pids = 96 }) {
  assert.equal(process.platform, 'linux', 'Use the explicit constrained Linux artwork lane');
  const kernel = async path => (await readFile(`/sys/fs/cgroup/${path}`, 'utf8')).trim();
  let version = 2; let limit;
  try { limit = await kernel('memory.max'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; version = 1; limit = await kernel('memory/memory.limit_in_bytes'); }
  assert.equal(limit, String(memoryBytes), 'Require the declared memory profile');
  if (version === 2) {
    assert.equal(await kernel('memory.swap.max'), '0'); assert.equal(await kernel('pids.max'), String(pids));
    const [quota, period] = (await kernel('cpu.max')).split(' ').map(Number); assert.equal(quota / period, cpus);
  } else {
    assert.equal(await kernel('memory/memory.memsw.limit_in_bytes'), limit); assert.equal(await kernel('pids/pids.max'), String(pids));
    assert.equal(Number(await kernel('cpu/cpu.cfs_quota_us')) / Number(await kernel('cpu/cpu.cfs_period_us')), cpus);
  }
  return { version, async snapshot() {
    const events = await kernel(version === 2 ? 'memory.events' : 'memory/memory.oom_control');
    const match = /^oom_kill\s+(\d+)$/mu.exec(events); assert.ok(match, 'Require the kernel OOM-kill counter');
    return { oomKills: Number(match[1]), memoryPeakBytes: Number(await kernel(version === 2 ? 'memory.peak' : 'memory/memory.max_usage_in_bytes')) };
  } };
}
