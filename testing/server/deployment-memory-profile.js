/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { artworkWorkerCgroup } from './artwork-worker-cgroup.js';

/** Refuse live data and undeclared controls before a qualification acquires a pool. */
export async function requireDeploymentMemoryProfile() {
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(process.env.PGDATABASE, 'harmoniarr_memory_qualification');
  assert.equal(process.env.PGDATA, '/app/data/postgres/18/data');
  assert.ok(!process.env.HARMONIARR_APPDATA || process.env.HARMONIARR_APPDATA === '/app/data');
  const dataMount = (await readFile('/proc/self/mountinfo', 'utf8')).split('\n').find(line => line.split(' ')[4] === '/app/data');
  assert.equal(dataMount?.split(' - ')[1]?.split(' ')[0], 'tmpfs', 'Require disposable app/database storage without a host data mount');
  const gib = Number(process.env.HARMONIARR_MEMORY_PROFILE_GIB ?? 3); assert.ok([2, 3].includes(gib));
  const profile = await artworkWorkerCgroup({ memoryBytes: gib * 1024 ** 3, cpus: 2, pids: 256 });
  // Public fixture material only. No notification or live credential is used.
  process.env.VAPID_CONTACT = 'mailto:memory-qualification@example.invalid';
  process.env.VAPID_PUBLIC_KEY = 'BN9CEVhAa-agHfE816dgSQUoOhYCng4hD86REpzvPg3wzlT8fr9LmvK60sb70uhX-vk0UFixyFak3dhk6SPyKRA';
  process.env.VAPID_PRIVATE_KEY = 'tt5cAktvbcZtFB5tTbQr7eOaNWFH_-OvsAWx-yE9E00';
  return { gib, profile };
}
