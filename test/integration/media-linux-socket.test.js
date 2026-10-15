/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createLibraryAddMediaFixture } from '../../testing/integration/library-add-media-fixtures.js';
import { captureMediaInspectionPolicy, mediaInspectionPrefix } from '../../testing/integration/owned-media-inspection-policy.js';
import { createOwnedMediaDockerTransport } from '../../testing/integration/owned-media-docker-transport.js';
import { resolveMediaDockerEndpoint } from '../../testing/integration/media-docker-endpoint-policy.js';
import { createMediaLinuxProofRunner } from '../../testing/integration/media-linux-proof-runner.js';

const executeFile = promisify(execFile); const active = new Set();
after(async () => { await Promise.allSettled([...active]); }, { timeout: 90_000 });
const readerImage = process.env.HARMONIARR_INTEGRATION_LINUX_READER_IMAGE;
const mediaImage = process.env.HARMONIARR_INTEGRATION_MEDIA_IMAGE;

test('native Linux socket matches host CLI for running, active-exec and stopped owners', {
  timeout: 90_000, skip: (!readerImage || !mediaImage) && 'Requires explicit local Linux reader and media images',
}, () => {
  const operation = (async () => {
    const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-linux-proof-'));
    const rootPolicy = await captureMediaInspectionPolicy(directory);
    const mediaRoot = join(directory, 'media'); const proofRoot = join(directory, 'proof');
    await mkdir(mediaRoot); await mkdir(proofRoot);
    let env = Object.freeze({ ...process.env }); let id; let failed = false; let failure; let cleanupSafe = true; let runnerCleanupSafe = true;
    const invoke = args => executeFile('docker', args, { env, timeout: 30_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true, shell: false });
    let transport;
    const remember = error => { if (!failed) { failed = true; failure = error; } };
    try {
      env = (await resolveMediaDockerEndpoint({ env, invoke: (_phase, args) => invoke(args) })).env;
      const daemon = (await invoke(['info', '--format', '{{.ID}}'])).stdout.trim();
      const media = createLibraryAddMediaFixture({ getFixtureRoot: () => mediaRoot });
      const source = join(mediaRoot, 'current.wav'); await media.generateAudio(source);
      const modules = ['media-linux-socket-scenario', 'media-docker-inspection-reader', 'media-docker-endpoint-policy',
        'media-docker-json-reader', 'media-transport-phase-observer', 'media-transport-phase-policy', 'pool-checkout-record', 'owned-media-inspection-policy'];
      await Promise.all(modules.map(name => copyFile(new URL(`../../testing/integration/${name}.js`, import.meta.url), join(proofRoot, `${name}.js`))));
      await copyFile(new URL('../../testing/docker/media-linux-socket-entry.js', import.meta.url), join(proofRoot, 'entry.js'));
      await writeFile(join(proofRoot, 'package.json'), '{"type":"module"}\n');
      transport = createOwnedMediaDockerTransport({ image: mediaImage, root: mediaRoot, executeFileFn: async (binary, args, options) => {
        const result = await executeFile(binary, args, { ...options, env }); if (args[0] === 'create') id = result.stdout.trim(); return result;
      } });
      cleanupSafe = false; await transport.start();
      assert.equal(JSON.parse((await transport.run([...mediaInspectionPrefix, '/fixtures/current.wav'])).stdout).format.tags.title, 'Controlled song');
      for (const phase of ['running', 'active', 'stopped']) {
        if (phase === 'active') await invoke(['exec', '--detach', id, 'sleep', '60']);
        if (phase === 'stopped') await transport.retire();
        const [state] = JSON.parse((await invoke(['inspect', id])).stdout);
        const running = phase !== 'stopped'; const hasExec = phase === 'active';
        assert.equal(state.State.Running, running); assert.equal(Boolean(state.ExecIDs?.length), hasExec);
        await writeFile(join(proofRoot, 'input.json'), JSON.stringify({ state, daemon, running, active: hasExec }));
        const runner = createMediaLinuxProofRunner({ image: readerImage, root: proofRoot, invoke });
        let result; let runnerFailed = false; let runnerError;
        try { result = await runner.run(); } catch (error) { runnerFailed = true; runnerError = error; }
        try { await runner.close(); } catch (error) {
          // A runner with an uncertain bind-mount lifetime prevents workspace deletion.
          runnerCleanupSafe = false;
          if (!runnerFailed) { runnerFailed = true; runnerError = error; }
        }
        if (runnerFailed) throw runnerError;
        const proof = JSON.parse(result.stdout);
        assert.deepEqual({ ...proof, node: undefined }, { platform: 'linux', node: undefined, running, active: hasExec, inspections: 3, closed: true });
        assert.match(proof.node, /^v24\./u);
      }
    } catch (error) { remember(error); }
    if (transport) {
      try { await transport.retire(); await transport.remove(); cleanupSafe = runnerCleanupSafe; } catch (error) { remember(error); }
    }
    try { if (cleanupSafe) { await rootPolicy.assertRoot(); await rm(directory, { recursive: true, force: true }); } } catch (error) { remember(error); }
    if (failed) throw failure;
  })();
  active.add(operation); operation.then(() => active.delete(operation), () => active.delete(operation)); return operation;
});
