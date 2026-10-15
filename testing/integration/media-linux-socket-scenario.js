/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { createMediaDockerInspectionReader } from './media-docker-inspection-reader.js';
import { createMediaTransportObserver } from './media-transport-phase-observer.js';

/** Executed only in the explicit socket-proof fixture; stdout contains no native payload. */
export async function proveLinuxMediaSocket({ inputPath, executeFileFn = promisify(execFile) }) {
  assert.equal(process.platform, 'linux');
  const { state, daemon, running, active } = JSON.parse(await readFile(inputPath, 'utf8'));
  assert.match(state.Id, /^[a-f0-9]{64}$/u); assert.equal(typeof daemon, 'string');
  let env = { ...process.env, DOCKER_HOST: 'unix:///var/run/docker.sock' }; delete env.DOCKER_CONTEXT;
  const transportObserver = createMediaTransportObserver();
  const invoke = async (_phase, args) => {
    // This native proof runner has no mutation command interface.
    assert.ok(['version', 'info'].includes(args[0]));
    const result = await executeFileFn('docker', args, { env, timeout: 30_000, maxBuffer: 2 * 1024 * 1024, shell: false });
    if (args[0] === 'info') assert.equal(result.stdout.trim(), daemon);
    return result;
  };
  const reader = await createMediaDockerInspectionReader({ invoke, env, transportObserver, setEnvironment: pinned => { env = pinned; } });
  let failed = false; let failure;
  try {
    for (let i = 0; i < 3; i++) {
      const current = await reader.inspect(state.Id);
      assert.deepEqual(current, state); assert.equal(current.State.Running, running);
      assert.equal(Boolean(current.ExecIDs?.length), active);
    }
  } catch (error) { failed = true; failure = error; }
  try { await reader.close(); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  await assert.rejects(reader.inspect(state.Id), { code: 'fixture_media_reader_closed' });
  assert.ok(transportObserver.snapshot().phases.every(row => row.pending === 0 && row.failed === 0));
  return Object.freeze({ platform: process.platform, node: process.version, running, active, inspections: 3, closed: true });
}
