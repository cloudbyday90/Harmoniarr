/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

const execute = promisify(execFile);
export const profileDocker = async (args, options = {}) => (await execute('docker', args, { windowsHide: true, maxBuffer: 2 * 1024 * 1024, timeout: 30_000, ...options })).stdout;

/** A CLI completion is not retirement: inspect, stop if needed, await and remove. */
export async function withFolderProfileContainer({ args, command, image, owner, signal, timeout = 120_000, docker = profileDocker, onRetired = () => {} }) {
  if (!Array.isArray(command) || command.length < 2) throw new TypeError('Require an explicit worker command');
  const name = 'harmoniarr-folder-profile-' + randomUUID();
  let id, admitted = false;
  return withWorkerTaskCleanup(async () => {
    signal?.throwIfAborted();
    admitted = true;
    // Creation is allowed to settle even after cancellation so its exact ID is owned.
    id = (await docker(['create', ...args, '--name', name, '--label', 'harmoniarr.folder-profile=' + owner, image, ...command])).trim();
    assert.match(id, /^[a-f0-9]{64}$/u);
    const created = JSON.parse(await docker(['inspect', id]))[0];
    assert.equal(created.Id, id); assert.equal(created.Image, image); assert.equal(created.Config.Labels['harmoniarr.folder-profile'], owner);
    assert.equal(created.HostConfig.Memory, 1024 ** 3); assert.equal(created.HostConfig.MemorySwap, 1024 ** 3);
    assert.equal(created.HostConfig.NanoCpus, 2_000_000_000); assert.equal(created.HostConfig.ReadonlyRootfs, true);
    assert.equal(created.HostConfig.NetworkMode, 'none');
    assert.ok(created.HostConfig.CapDrop.includes('ALL'));
    assert.ok(created.HostConfig.SecurityOpt.includes('no-new-privileges:true'));
    assert.equal(created.Mounts.find(mount => mount.Destination === '/app/benchmark').RW, false);
    if (created.Config.User === '1000:1000' && created.Mounts.some(mount => mount.Destination === '/fixtures')) assert.equal(created.Mounts.find(mount => mount.Destination === '/fixtures').RW, false);
    signal?.throwIfAborted();
    const output = await docker(['start', '--attach', id], { signal, timeout });
    const finished = JSON.parse(await docker(['inspect', id]))[0];
    assert.equal(finished.State.Running, false); assert.equal(finished.State.ExitCode, 0); assert.equal(finished.State.OOMKilled, false);
    const value = JSON.parse(output.trim()); assert.equal(value.owner, owner); return value;
  }, async () => {
    if (!admitted) return;
    if (!id || !/^[a-f0-9]{64}$/u.test(id)) {
      const found = (await docker(['ps', '-aq', '--no-trunc', '--filter', 'name=^/' + name + '$'])).trim();
      if (!/^[a-f0-9]{64}$/u.test(found)) throw new Error('Container creation retirement is uncertain');
      id = found;
    }
    const row = JSON.parse(await docker(['inspect', id]))[0];
    assert.equal(row.Id, id); assert.equal(row.Image, image); assert.equal(row.Config.Labels['harmoniarr.folder-profile'], owner);
    if (row.State.Running) await docker(['kill', id]);
    if (row.State.Status !== 'created') await docker(['wait', id]);
    assert.equal(JSON.parse(await docker(['inspect', id]))[0].State.Running, false);
    assert.equal((await docker(['rm', '--volumes', id])).trim(), id);
    assert.equal((await docker(['ps', '-aq', '--no-trunc', '--filter', 'id=' + id])).trim(), '');
    onRetired();
  });
}
