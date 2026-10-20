/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { renderManagedSlskdConfig } from '../../docker/managed-slskd-config.js';
import { assertDockerProjectRemoved, removeOwnedDockerWorkspace } from '../../scripts/docker-smoke-cleanup.js';
import { executeFixtureProbeCommand } from '../integration/fixture-probe-command.js';
import { nativeProviderCompose } from './native-provider-compose.js';
import { acknowledgeNativeFileVolume } from './native-file-volume.js';

const immutable = /^sha256:[a-f0-9]{64}$/u;
const prefix = 'harmoniarr-native-slskd-';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

export function requireNativeSlskdImages(env = process.env) {
  const applicationImage = env.HARMONIARR_NATIVE_APP_IMAGE;
  const providerImage = env.HARMONIARR_NATIVE_SLSKD_IMAGE;
  if (!immutable.test(applicationImage ?? '') || !immutable.test(providerImage ?? '')) {
    throw new TypeError('Native slskd validation requires local immutable HARMONIARR_NATIVE_APP_IMAGE and HARMONIARR_NATIVE_SLSKD_IMAGE IDs');
  }
  return { applicationImage, providerImage };
}

async function acknowledgeService({ id, image, projectName, networkId, inspect }) {
  if (!/^[a-f0-9]{64}$/u.test(id)) throw new Error('Native service identity missing');
  const value = await inspect(id);
  assert.equal(value.Id, id); assert.equal(value.Image, image);
  assert.equal(value.Config.Labels['com.docker.compose.project'], projectName);
  assert.equal(value.HostConfig.ReadonlyRootfs, true); assert.equal(value.Config.User, '1000:1000');
  assert.deepEqual(value.HostConfig.CapDrop, ['ALL']);
  assert.ok(value.HostConfig.SecurityOpt.includes('no-new-privileges:true'));
  assert.ok(value.HostConfig.Memory > 0); assert.equal(value.HostConfig.PidsLimit, 128);
  const networks = Object.values(value.NetworkSettings.Networks);
  assert.equal(networks.length, 1); assert.equal(networks[0].NetworkID, networkId);
  assert.ok(Object.values(value.NetworkSettings.Ports ?? {}).every(bindings => bindings == null || bindings.length === 0));
  assert.deepEqual(value.HostConfig.PortBindings ?? {}, {});
  assert.ok(value.Mounts.filter(mount => mount.Type === 'bind').every(mount => mount.RW === false));
}

export async function withNativeSlskdProvider({ applicationImage, providerImage, signal,
  rootDir = process.cwd(), execute = executeFixtureProbeCommand, runScenario = null,
  mode = 'batch', expectedVersion = '0.26.0.0' } = {}) {
  if (!['batch', 'cancellation', 'files', 'partial', 'resume', 'refusal', 'audio'].includes(mode) || !['0.26.0.0', '0.26.1.0'].includes(expectedVersion)) {
    throw new TypeError('Unreviewed native fixture mode or version');
  }
  if (mode === 'cancellation' && typeof runScenario !== 'function') throw new TypeError('Cancellation requires its explicit scenario');
  if (['partial', 'resume', 'refusal', 'audio'].includes(mode) && typeof runScenario !== 'function') throw new TypeError('File modes require their explicit scenario');
  requireNativeSlskdImages({ HARMONIARR_NATIVE_APP_IMAGE: applicationImage, HARMONIARR_NATIVE_SLSKD_IMAGE: providerImage });
  const projectName = 'harmoniarrnative' + randomUUID().replaceAll('-', '');
  const workspaceRoot = await mkdtemp(resolve(tmpdir(), prefix));
  const key = () => randomBytes(24).toString('hex');
  const secrets = { apiKey: key(), jwtKey: key(), soulseekUsername: 'fixture-client', soulseekPassword: key(),
    webUsername: 'fixture-web', webPassword: key() };
  const composeArgs = ['compose', '-f', resolve(workspaceRoot, 'compose.json'), '-p', projectName];
  const docker = async (args, abort = signal) => (await execute('docker', args, { signal: abort })).stdout.trim();
  const inspect = async id => JSON.parse(await docker(['inspect', id]))[0];
  let failed = false; let failure; let result; let closed; let cleanupVerified = false; let startupAcknowledged = false;
  try {
    await writeFile(resolve(workspaceRoot, 'fixture.json'), JSON.stringify({ username: secrets.soulseekUsername,
      password: secrets.soulseekPassword, apiKey: secrets.apiKey, mode, expectedVersion }), { mode: 0o600 });
    const inactivity = mode === 'cancellation' ? '  connection:\n    timeout:\n      inactivity: 240000\n' : '';
    const retries = mode === 'partial' ? 'transfers:\n  download:\n    retry:\n      attempts: 1\n' : '';
    await writeFile(resolve(workspaceRoot, 'slskd.yml'), renderManagedSlskdConfig(secrets) + inactivity + retries, { mode: 0o600 });
    await writeFile(resolve(workspaceRoot, 'compose.json'), JSON.stringify(nativeProviderCompose({ rootDir,
      workspaceRoot, applicationImage, providerImage, mode })), { mode: 0o600 });
    await docker([...composeArgs, 'up', '--no-build', '--pull', 'never', '--detach', '--wait', '--wait-timeout', '20']);
    startupAcknowledged = true;
    const fixtureId = await docker([...composeArgs, 'ps', '-q', 'fixture']);
    const providerId = await docker([...composeArgs, 'ps', '-q', 'provider']);
    const networks = await docker(['network', 'ls', '--filter', `label=com.docker.compose.project=${projectName}`, '--format', '{{.ID}}']);
    assert.match(networks, /^[a-f0-9]{12}$/u);
    const network = JSON.parse(await docker(['network', 'inspect', networks]))[0];
    assert.equal(network.Internal, true);
    assert.equal(network.Labels['com.docker.compose.project'], projectName);
    await acknowledgeService({ id: fixtureId, image: applicationImage, projectName, networkId: network.Id, inspect });
    await acknowledgeService({ id: providerId, image: providerImage, projectName, networkId: network.Id, inspect });
    const probe = "import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';console.log(JSON.stringify({version:process.versions.node,platform:process.platform,arch:process.arch,uid:process.getuid(),lock:createHash('sha256').update(await readFile('/app/package-lock.json')).digest('hex'),policy:createHash('sha256').update(await readFile('/app/src/server/slskd/slskd-download-protocol-policy.js')).digest('hex')}));";
    const runtime = JSON.parse(await docker(['exec', fixtureId, 'node', '--input-type=module', '-e', probe]));
    assert.equal(runtime.version, (await readFile(resolve(rootDir, '.nvmrc'), 'utf8')).trim());
    assert.equal(runtime.platform, 'linux'); assert.equal(runtime.uid, 1000);
    assert.ok(['x64', 'arm64'].includes(runtime.arch));
    assert.equal(runtime.lock, hash(await readFile(resolve(rootDir, 'package-lock.json'))));
    assert.equal(runtime.policy, hash(await readFile(resolve(rootDir, 'src/server/slskd/slskd-download-protocol-policy.js'))));
    const storage = ['files', 'partial', 'resume', 'refusal', 'audio'].includes(mode) ? await acknowledgeNativeFileVolume({ provider: await inspect(providerId), fixture: await inspect(fixtureId),
      projectName, mode, inspectVolume: async name => JSON.parse(await docker(['volume', 'inspect', name]))[0] }) : null;
    result = runScenario ? await runScenario({ docker, fixtureId, providerId }) : JSON.parse(await docker(['exec', fixtureId, 'node', '/app/testing/slskd/native-batch-scenario.js']));
    result = { ...result, runtime, applicationImage, providerImage, ...(storage ? { storage } : {}) };
  } catch (error) { failed = true; failure = error; }
  for (const service of ['provider', 'fixture']) {
    try { await docker([...composeArgs, 'stop', '--timeout', '5', service], null); }
    catch (error) { if (!failed) { failed = true; failure = error; } }
  }
  try {
    const logs = await docker([...composeArgs, 'logs', '--no-color', '--no-log-prefix', 'fixture'], null);
    closed = logs.split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line)).find(row => row.kind === 'closed');
    if (!failed) {
      assert.equal(closed?.activeSockets, 0); assert.equal(closed.refused, 0, JSON.stringify(closed));
      const id = await docker([...composeArgs, 'ps', '--all', '-q', 'fixture'], null);
      const stopped = JSON.parse(await docker(['inspect', id], null))[0];
      assert.equal(stopped.State.Running, false); assert.equal(stopped.State.ExitCode, 0);
    }
  } catch (error) { if (!failed) { failed = true; failure = error; } }
  try {
    await docker([...composeArgs, 'down', '--remove-orphans', '--volumes', '--timeout', '5'], null);
    await assertDockerProjectRemoved({ projectName, runCommandFn: async ({ args }) => ({ stdout: await docker(args, null), exitCode: 0 }) });
    cleanupVerified = true;
    // A failed/unacknowledged startup may still have daemon work in flight.
    if (startupAcknowledged) await removeOwnedDockerWorkspace({ workspaceRoot, tempRootDir: tmpdir(), prefix });
  } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  return { ...result, fixture: closed, cleanupVerified };
}
