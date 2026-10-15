/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createLibraryAddMediaFixture } from '../../testing/integration/library-add-media-fixtures.js';
import { createOwnedMediaInspectionExecutor } from '../../testing/integration/owned-media-inspection-executor.js';
import { createOwnedMediaDockerTransport } from '../../testing/integration/owned-media-docker-transport.js';
import { mediaInspectionPrefix } from '../../testing/integration/owned-media-inspection-policy.js';
import { createMediaTransportObserver } from '../../testing/integration/media-transport-phase-observer.js';
import { createMediaDockerInspectionReader } from '../../testing/integration/media-docker-inspection-reader.js';

const executeFile = promisify(execFile); const active = new Set();
after(async () => { await Promise.allSettled([...active]); }, { timeout: 90_000 });
function scenario(t, options, work) {
  const operation = (async () => {
    const root = await mkdtemp(join(tmpdir(), 'harmoniarr-owned-media-')); const calls = []; let id; let original; let inspectCurrent;
    const media = createLibraryAddMediaFixture({ getFixtureRoot: () => root });
    const transportObserver = createMediaTransportObserver();
    const executor = createOwnedMediaInspectionExecutor({ workspaceDir: root, signal: t.signal, transportObserver, inspectionReadMode: options.mode ?? 'cli',
      createTransport: input => createOwnedMediaDockerTransport({ ...input, commandTimeoutMs: options.hang ? 500 : 30_000,
        createInspectionReader: async bootstrap => {
          let pinnedEnv;
          const reader = await createMediaDockerInspectionReader({ ...bootstrap,
            setEnvironment: env => { pinnedEnv = env; bootstrap.setEnvironment(env); } });
          inspectCurrent = async containerId => {
            const state = await reader.inspect(containerId);
            const [cli] = JSON.parse((await executeFile('docker', ['inspect', containerId], { timeout: 30_000,
              maxBuffer: 2 * 1024 * 1024, windowsHide: true, env: pinnedEnv })).stdout);
            assert.deepEqual(state, cli); return state;
          };
          return { close: reader.close, inspect: inspectCurrent };
        },
        executeFileFn: async (binary, args, commandOptions) => {
          calls.push(args);
          const actual = options.hang && args[0] === 'exec' ? ['exec', args[1], 'sh', '-c', 'sleep 60'] : args;
          try {
            const result = await executeFile(binary, actual, commandOptions);
            if (args[0] === 'create') id = result.stdout.trim();
            return result;
          } catch (error) { if (args[0] === 'exec') original = error; throw error; }
        },
      }),
    });
    const source = join(root, 'current.wav'); const args = [...mediaInspectionPrefix, source];
    let failed = false; let failure;
    try { await media.generateAudio(source); await work({ root, source, args, media, executor, calls, id: () => id,
      original: () => original, inspectCurrent: () => inspectCurrent(id) }); }
    catch (error) { failed = true; failure = error; }
    try { await executor.close(); } catch (error) { if (!failed) { failed = true; failure = error; } }
    if (!failed) {
      try {
        const snapshot = transportObserver.snapshot();
        const apiReads = options.mode === 'api' ? snapshot.phases.filter(row => row.phase.includes('inspect') && row.phase !== 'image_inspect'
          || row.phase.endsWith('_api')).reduce((sum, row) => sum + row.started, 0) : 0;
        assert.equal(snapshot.phases.reduce((sum, row) => sum + row.started, 0), calls.length + apiReads);
        assert.ok(snapshot.phases.every(row => row.pending === 0));
        const command = snapshot.phases.find(row => row.phase === 'command_exec');
        assert.equal(command.started, calls.filter(argsRow => argsRow[0] === 'exec').length);
        assert.equal(command.failed, options.hang || original ? 1 : 0);
        assert.ok(!JSON.stringify(snapshot).includes(root)); assert.ok(!JSON.stringify(snapshot).includes(id));
      } catch (error) { failed = true; failure = error; }
    }
    try { if (executor.canRemoveWorkspace()) await rm(root, { recursive: true, force: true }); }
    catch (error) { if (!failed) { failed = true; failure = error; } }
    if (failed) throw failure;
  })();
  active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); return operation;
}

const nativeOptions = { timeout: 90_000, skip: !process.env.HARMONIARR_INTEGRATION_MEDIA_IMAGE && 'Requires an existing local media image' };
test('API current ExecIDs agree with CLI and refuse another command until whole-owner retirement', nativeOptions,
  t => scenario(t, { mode: 'api' }, async ({ executor, args, id, inspectCurrent, calls }) => {
    await executor.run('ffprobe', args);
    await executeFile('docker', ['exec', '--detach', id(), 'sleep', '60'], { timeout: 30_000, windowsHide: true });
    try {
      const state = await inspectCurrent();
      assert.ok(state.ExecIDs?.length); assert.equal(state.State.Running, true);
      await assert.rejects(executor.run('ffprobe', args), { code: 'fixture_media_not_quiescent' });
      const stopped = await inspectCurrent(); assert.equal(stopped.State.Running, false); assert.ok(!stopped.ExecIDs?.length);
      assert.equal(calls.filter(row => row[0] === 'exec').length, 1);
    } finally { await executor.close(); }
  }));

for (const mode of ['cli', 'api']) {
test(`${mode} isolated inspection owner re-reads changed media and seals after close`, nativeOptions, t => scenario(t, { mode }, async ({ root, source, args, media, executor, calls, id }) => {
  const first = JSON.parse((await executor.run('ffprobe', args)).stdout);
  await assert.rejects(executeFile('docker', ['exec', id(), 'touch', '/fixtures/forbidden'], { timeout: 30_000, windowsHide: true }));
  const [state] = JSON.parse((await executeFile('docker', ['inspect', id()], { timeout: 30_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true })).stdout);
  assert.equal(state.HostConfig.NetworkMode, 'none'); assert.equal(state.HostConfig.Mounts[0].Source, root);
  assert.equal(state.Mounts[0].RW, false); assert.equal(state.HostConfig.ReadonlyRootfs, true);
  assert.deepEqual(state.Config.Healthcheck.Test, ['NONE']);
  await media.mediaCommand('ffmpeg', ['-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'sine=frequency=500:sample_rate=44100',
    '-t', '1', '-ac', '2', '-metadata', 'title=Changed current media', source], { readonly: false });
  const second = JSON.parse((await executor.run('ffprobe', args)).stdout);
  assert.equal(first.format.tags.title, 'Controlled song'); assert.equal(second.format.tags.title, 'Changed current media');
  assert.notEqual(first.format.duration, second.format.duration);
  assert.equal(calls.filter(row => row[0] === 'create').length, 1); assert.equal(calls.filter(row => row[0] === 'exec').length, 2);
  await executor.close(); assert.equal(executor.canRemoveWorkspace(), true);
  await assert.rejects(executor.run('ffprobe', args), { code: 'fixture_media_admission_closed' });
}));

for (const hang of [false, true]) {
  test(`${mode} native ${hang ? 'held exec timeout' : 'nonzero ffprobe'} retires the acknowledged container before workspace cleanup`, nativeOptions,
    t => scenario(t, { hang, mode }, async ({ source, args, executor, id, original, calls }) => {
      if (!hang) await writeFile(source, 'invalid-current-audio');
      await assert.rejects(executor.run('ffprobe', args), error => error === original());
      const [state] = JSON.parse((await executeFile('docker', ['inspect', id()], { timeout: 30_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true })).stdout);
      assert.equal(state.State.Running, false); assert.ok(!state.ExecIDs?.length);
      assert.equal(calls.filter(row => row[0] === 'stop').length, 1);
      assert.equal(calls.filter(row => row[0] === 'exec').length, 1);
      assert.equal(executor.canRemoveWorkspace(), false);
      await executor.close(); assert.equal(executor.canRemoveWorkspace(), true);
    }));
}
}
