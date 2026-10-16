/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { preflightIntegrationTests } from '../../testing/integration/integration-test-preflight.js';
import { probeIntegrationTool } from '../../testing/integration/integration-tool-probe.js';
import { integrationProbeLabel, integrationProbeVersion } from '../../testing/integration/integration-preflight-policy.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';

const pg = 'sha256:' + 'a'.repeat(64); const media = 'sha256:' + 'b'.repeat(64); const reader = 'sha256:' + 'c'.repeat(64);
const digest = 'sha256:' + 'd'.repeat(64); const ref = 'postgres:18-alpine@' + digest;
const env = { HARMONIARR_INTEGRATION_MEDIA_IMAGE: media, HARMONIARR_INTEGRATION_LINUX_READER_IMAGE: reader,
  HARMONIARR_INTEGRATION_PG_POOL_MAX: '2', PGPASSWORD: 'private-canary' };
function fixture() {
  const calls = []; let state; let mutate = () => {}; let start = async () => ({ stdout: 'v24.21.0\n' });
  const id = 'e'.repeat(64);
  const invoke = async (args, options = {}) => {
    calls.push({ args, options });
    if (args[0] === 'create') {
      const tool = args[args.indexOf('--entrypoint') + 1]; const pgMount = tool === 'postgres';
      state = { Id: id, Image: reader, Config: { Labels: { [integrationProbeLabel]: args[args.indexOf('--label') + 1].split('=')[1] },
        Entrypoint: [tool], Cmd: [args.at(-1)], User: '65534:65534', Healthcheck: { Test: ['NONE'] } },
      HostConfig: { NetworkMode: 'none', ReadonlyRootfs: true, Privileged: false, RestartPolicy: { Name: 'no' },
        AutoRemove: false, CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges'],
        ...(pgMount ? { Mounts: [{ Type: 'tmpfs', Target: '/var/lib/postgresql', TmpfsOptions: { SizeBytes: 1048576 } }] } : {}) },
      Mounts: pgMount ? [{ Type: 'tmpfs', Destination: '/var/lib/postgresql' }] : [], ExecIDs: null,
      State: { Running: false, ExitCode: 0 } };
      return { stdout: id + '\n' };
    }
    if (args[0] === 'inspect') { mutate(state, calls); return { stdout: JSON.stringify([state]) }; }
    if (args[0] === 'start') return start(state, options);
    if (args[0] === 'stop') state.State.Running = false;
    return { stdout: '' };
  };
  return { calls, invoke, id, get state() { return state; }, set mutate(value) { mutate = value; }, set start(value) { start = value; } };
}

test('preflight inspects local Linux images, pins reviewed PostgreSQL reference and preserves copied resource settings', async () => {
  const inspected = []; const tools = [];
  const result = await preflightIntegrationTests({ env, executeFileFn: async (binary, args, options) => {
    assert.equal(binary, 'docker'); assert.equal(options.shell, false); assert.equal(options.timeout, 30_000);
    assert.equal(options.env.PGPASSWORD, undefined); inspected.push(args[2]);
    const postgres = args[2].startsWith('postgres:');
    return { stdout: JSON.stringify([{ Id: postgres ? pg : args[2], Os: 'linux',
      RepoDigests: ['postgres@' + digest], Config: { Volumes: postgres ? { '/var/lib/postgresql': {} } : undefined } }]) };
  }, probe: async ({ tool, image }) => { tools.push({ tool, image }); return 'controlled'; } });
  assert.deepEqual(inspected, ['postgres:18-alpine', ref, media, reader]);
  assert.deepEqual(tools, [{ tool: 'postgres', image: pg }, { tool: 'ffmpeg', image: media },
    { tool: 'ffprobe', image: media }, { tool: 'node', image: reader }, { tool: 'docker', image: reader }]);
  assert.equal(result.env.HARMONIARR_INTEGRATION_POSTGRES_IMAGE, ref); assert.equal(result.env.HARMONIARR_INTEGRATION_PG_POOL_MAX, '2');
  assert.equal(result.env.PGPASSWORD, undefined); assert.equal(env.PGPASSWORD, 'private-canary');
  assert.equal(Object.isFrozen(result.env), true); assert.equal(Object.isFrozen(result.evidence.versions), true);
});

for (const fault of ['opaque-postgres', 'missing-reader', 'mutable-media', 'wrong-os', 'identity-drift', 'extra-volume', 'missing-digest', 'probe']) {
  test(`preflight refuses ${fault} before further capability or database work`, async () => {
    let probes = 0;
    const selected = { ...env, ...(fault === 'opaque-postgres' ? { HARMONIARR_INTEGRATION_POSTGRES_IMAGE: pg }
      : fault === 'missing-reader' ? { HARMONIARR_INTEGRATION_LINUX_READER_IMAGE: undefined }
        : fault === 'mutable-media' ? { HARMONIARR_INTEGRATION_MEDIA_IMAGE: 'media:latest' } : {}) };
    await assert.rejects(preflightIntegrationTests({ env: selected, executeFileFn: async (_binary, args) => {
      const postgres = args[2].startsWith('postgres:');
      return { stdout: JSON.stringify([{ Id: fault === 'identity-drift' && args[2] === ref ? reader : postgres ? pg : args[2],
        Os: fault === 'wrong-os' ? 'windows' : 'linux', RepoDigests: fault === 'missing-digest' ? [] : ['postgres@' + digest],
        Config: { Volumes: fault === 'extra-volume' ? { '/unexpected': {} } : postgres ? { '/var/lib/postgresql': {} } : undefined } }]) };
    }, probe: async () => { probes++; throw new Error('Controlled capability failure'); } }));
    assert.equal(probes, fault === 'probe' ? 1 : 0);
  });
}

test('version policy accepts the runtime floor and refuses unsupported, malformed or unbounded versions', () => {
  assert.equal(integrationProbeVersion('node', 'v24.15.0\n'), '24.15.0');
  assert.equal(integrationProbeVersion('postgres', 'postgres (PostgreSQL) 18.3\n'), '18.3');
  for (const [tool, output] of [['node', 'v24.14.0'], ['node', 'v25.0.0'], ['postgres', 'postgres (PostgreSQL) 17.4'],
    ['docker', 'missing'], ['ffprobe', 'x'.repeat(65537)]]) assert.throws(() => integrationProbeVersion(tool, output));
});

test('fixed version probe validates before start and removes only its acknowledged stopped owner', async () => {
  const f = fixture(); assert.equal(await probeIntegrationTool({ image: reader, tool: 'node', invoke: f.invoke }), '24.21.0');
  assert.deepEqual(f.calls.map(row => row.args[0]), ['create', 'inspect', 'start', 'inspect', 'inspect', 'inspect', 'rm']);
  assert.deepEqual(f.calls.at(-1).args, ['rm', f.id]);
  assert.deepEqual(f.calls[0].args.slice(0, 3), ['create', '--pull', 'never']);
  assert.equal(f.calls[0].args.includes('--mount'), false); assert.equal(f.calls[0].args.includes('--privileged'), false);
});

for (const fault of ['image', 'label', 'command', 'mount', 'active-exec', 'running', 'exit', 'version']) {
  test(`owner or capability ${fault} refuses success and never guesses a sibling cleanup target`, async () => {
    const f = fixture();
    f.mutate = state => {
      if (fault === 'image') state.Image = media;
      if (fault === 'label') state.Config.Labels[integrationProbeLabel] = 'sibling';
      if (fault === 'command') state.Config.Cmd = ['unexpected'];
      if (fault === 'mount') state.Mounts = [{ Type: 'bind', Destination: '/host' }];
      if (fault === 'active-exec') state.ExecIDs = ['unknown'];
      if (fault === 'running') state.State.Running = true;
      if (fault === 'exit') state.State.ExitCode = 1;
    };
    if (fault === 'version') f.start = async () => ({ stdout: 'v18.0.0\n' });
    await assert.rejects(probeIntegrationTool({ image: reader, tool: 'node', invoke: f.invoke }));
    assert.equal(f.calls.filter(row => ['stop', 'rm'].includes(row.args[0])).every(row => row.args.at(-1) === f.id), true);
    if (['image', 'label', 'command', 'mount'].includes(fault)) {
      assert.equal(f.calls.some(row => ['start', 'stop', 'rm'].includes(row.args[0])), false);
    }
  });
}

test('uncertain creation never starts or removes an inferred owner', async () => {
  const f = fixture();
  const invoke = async (args, options) => args[0] === 'create' ? { stdout: 'truncated-id' } : f.invoke(args, options);
  await assert.rejects(probeIntegrationTool({ image: reader, tool: 'node', invoke })); assert.deepEqual(f.calls, []);
});

test('ownership drift after attached start refuses every later stop or removal', async () => {
  const f = fixture(); f.start = async state => { state.Image = media; return { stdout: 'v24.21.0' }; };
  await assert.rejects(probeIntegrationTool({ image: reader, tool: 'node', invoke: f.invoke }));
  assert.equal(f.calls.some(row => ['stop', 'rm'].includes(row.args[0])), false);
});

test('unverified remote stop refuses removal even after a successful stop acknowledgement', async () => {
  const f = fixture(); f.start = async state => { state.State.Running = true; throw new Error('Controlled timeout'); };
  const invoke = async (args, options) => args[0] === 'stop' ? { stdout: f.id } : f.invoke(args, options);
  await assert.rejects(probeIntegrationTool({ image: reader, tool: 'node', invoke }), { message: 'Controlled timeout' });
  assert.equal(f.calls.some(row => row.args[0] === 'rm'), false);
});

test('cleanup failure alone refuses otherwise successful capability work', async () => {
  const f = fixture(); const failure = new Error('Controlled removal failure');
  const invoke = async (args, options) => { if (args[0] === 'rm') throw failure; return f.invoke(args, options); };
  await assert.rejects(probeIntegrationTool({ image: reader, tool: 'node', invoke }), error => error === failure);
});

for (const primary of [new Error('Controlled missing tool'), null]) {
  test(`original ${primary === null ? 'null' : 'Error'} survives retirement failure`, async () => {
    const f = fixture(); f.start = async () => { throw primary; };
    const invoke = async (args, options) => { if (args[0] === 'rm') throw new Error('Secondary cleanup'); return f.invoke(args, options); };
    await assert.rejects(probeIntegrationTool({ image: reader, tool: 'node', invoke }), error => error === primary);
    assert.equal(f.calls.filter(row => row.args[0] === 'inspect').length, 3);
  });
}

test('cancellation awaits actual attached command and held remote retirement before settling', async t => {
  const f = fixture(); const entered = createFixtureGate(); const command = createFixtureGate();
  const stopping = createFixtureGate(); const retired = createFixtureGate(); const controller = new AbortController(); let settled = false;
  f.start = async state => { state.State.Running = true; entered.release(); await command.promise; return { stdout: 'v24.21.0' }; };
  const invoke = async (args, options) => {
    if (args[0] === 'stop') { assert.equal(options?.signal, undefined); stopping.release(); await retired.promise; }
    return f.invoke(args, options);
  };
  const pending = probeIntegrationTool({ image: reader, tool: 'node', signal: controller.signal, invoke });
  const observed = pending.then(() => { settled = true; }, () => { settled = true; });
  try {
    await waitForFixtureReady({ ready: entered.promise, operation: pending, signal: t.signal });
    controller.abort(null); await Promise.resolve(); assert.equal(settled, false); command.release();
    await waitForFixtureReady({ ready: stopping.promise, operation: pending, signal: t.signal });
    assert.equal(settled, false); retired.release(); await assert.rejects(pending, error => error === null);
    assert.deepEqual(f.calls.at(-1).args, ['rm', f.id]);
  } finally { command.release(); retired.release(); await observed; }
});

test('pre-aborted probe admits no native calls and preserves null', async () => {
  const f = fixture(); const controller = new AbortController(); controller.abort(null);
  await assert.rejects(probeIntegrationTool({ image: reader, tool: 'node', signal: controller.signal, invoke: f.invoke }), error => error === null);
  assert.deepEqual(f.calls, []);
  await assert.rejects(preflightIntegrationTests({ env: {}, signal: controller.signal,
    executeFileFn: () => assert.fail('Pre-aborted image inspection') }), error => error === null);
});

test('cancellation during final removal cannot return a successful capability', async () => {
  const f = fixture(); const controller = new AbortController();
  const invoke = async (args, options) => { const value = await f.invoke(args, options); if (args[0] === 'rm') controller.abort(null); return value; };
  await assert.rejects(probeIntegrationTool({ image: reader, tool: 'node', signal: controller.signal, invoke }), error => error === null);
  assert.deepEqual(f.calls.at(-1).args, ['rm', f.id]);
});
