/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRecoveryDockerCommand } from '../../scripts/postgres-recovery-command.js';
import { assertLocalRecoveryDocker } from '../../scripts/postgres-recovery-runtime.js';

const label = 'io.harmoniarr.manual-signals';
const files = ['package.json', 'testing/manual/manual-session-input.js', 'testing/manual/manual-session-runner.js',
  'testing/manual/manual-signal-child.js', 'test/signals/manual-session.test.js'];

/** Explicit Linux qualification, with no daemon socket or application data in the container. */
export async function runManualSignalLane({ env = process.env, runDocker = createRecoveryDockerCommand({ env }),
  readDockerfile = () => readFile('Dockerfile', 'utf8'), output = process.stdout, signal } = {}) {
  signal?.throwIfAborted();
  await assertLocalRecoveryDocker({ env, runDocker });
  signal?.throwIfAborted();
  const image = (await readDockerfile()).match(/^ARG NODE_IMAGE=(node:24\.22\.1-alpine[\d.]+@sha256:[a-f0-9]{64})\r?$/mu)?.[1];
  assert.ok(image, 'Signal lane requires the reviewed pinned Node image');
  const nonce = randomUUID(); const name = `harmoniarr-manual-signals-${nonce}`;
  let attempted = false; let id; let failed = false; let failure;
  async function inspectOwned() {
    const [container] = JSON.parse((await runDocker(['container', 'inspect', name])).stdout);
    assert.equal(container.Name, `/${name}`); assert.equal(container.Config.Labels[label], nonce);
    assert.match(container.Id, /^[a-f0-9]{64}$/u);
    if (id) assert.equal(container.Id, id);
    return container;
  }
  try {
    signal?.throwIfAborted();
    // Pull the immutable digest outside the isolated container. No test installs.
    await runDocker(['pull', image]);
    signal?.throwIfAborted();
    attempted = true;
    id = (await runDocker(['create', '--name', name, '--label', `${label}=${nonce}`, '--network', 'none', '--read-only',
      '--user', '1000:1000', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
      '--memory', '128m', '--cpus', '1', '--pids-limit', '64', '--workdir', '/fixture', '--entrypoint', 'node',
      ...files.flatMap(file => ['--mount', `type=bind,src=${resolve(file)},dst=/fixture/${file},readonly`]),
      image, '--test', '--test-concurrency=1', 'test/signals/manual-session.test.js'])).stdout.trim();
    const container = await inspectOwned();
    signal?.throwIfAborted();
    assert.equal(container.Config.User, '1000:1000'); assert.equal(container.Path, 'node');
    assert.equal(container.Config.Image, image);
    assert.equal(container.HostConfig.NetworkMode, 'none'); assert.equal(container.HostConfig.ReadonlyRootfs, true);
    assert.deepEqual(container.HostConfig.CapDrop, ['ALL']);
    assert.deepEqual(container.HostConfig.SecurityOpt, ['no-new-privileges:true']);
    assert.equal(container.HostConfig.Memory, 128 * 1024 * 1024); assert.equal(container.HostConfig.NanoCpus, 1e9);
    assert.equal(container.HostConfig.PidsLimit, 64); assert.equal(container.HostConfig.Privileged, false);
    assert.equal(Object.keys(container.HostConfig.PortBindings ?? {}).length, 0);
    assert.deepEqual(container.Mounts.map(mount => ({ destination: mount.Destination, source: mount.Source, rw: mount.RW, type: mount.Type }))
      .sort((a, b) => a.destination.localeCompare(b.destination)), files.map(file => ({ destination: `/fixture/${file}`,
        source: resolve(file), rw: false, type: 'bind' })).sort((a, b) => a.destination.localeCompare(b.destination)));
    const result = await runDocker(['start', '--attach', id], { expectedExitCodes: [0, 1], timeoutMs: 120_000 });
    output.write(result.stdout); output.write(result.stderr);
    signal?.throwIfAborted();
    const finished = await inspectOwned();
    assert.equal(finished.State.Running, false); assert.equal(finished.State.OOMKilled, false);
    assert.equal(finished.State.ExitCode, 0, 'Native Linux signal tests failed');
    assert.equal(result.exitCode, 0);
  } catch (error) { failed = true; failure = error; }
  try {
    if (attempted) {
      const present = (await runDocker(['container', 'ls', '--all', '--filter', `label=${label}=${nonce}`, '--format', '{{.ID}}'])).stdout.trim();
      if (present) await runDocker(['container', 'rm', '--force', '--volumes', (await inspectOwned()).Id]);
      assert.equal((await runDocker(['container', 'ls', '--all', '--filter', `label=${label}=${nonce}`, '--format', '{{.ID}}'])).stdout.trim(), '');
    }
  } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  return { image, retired: true, network: 'none', readOnlyFiles: files.length };
}
