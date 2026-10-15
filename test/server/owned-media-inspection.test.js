/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureMediaInspectionPolicy, mediaInspectionPrefix } from '../../testing/integration/owned-media-inspection-policy.js';
import { createOwnedMediaInspectionExecutor } from '../../testing/integration/owned-media-inspection-executor.js';
import { createOwnedMediaDockerTransport } from '../../testing/integration/owned-media-docker-transport.js';

const gate = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
async function fixture(work) {
  const directory = await mkdtemp(join(tmpdir(), 'harmoniarr-media-policy-')); const root = join(directory, 'owned');
  await mkdir(root); const source = join(root, 'current.flac'); await writeFile(source, 'controlled');
  try { await work({ directory, root, source, args: [...mediaInspectionPrefix, source] }); }
  finally { await rm(directory, { recursive: true, force: true }); }
}

test('inspection authorization rechecks contained current files and captured directory identity', () => fixture(async ({ directory, root, source, args }) => {
  const policy = await captureMediaInspectionPolicy(root);
  assert.deepEqual(await policy.map('ffprobe', args), [...mediaInspectionPrefix, '/fixtures/current.flac']);
  await writeFile(source, 'changed-current-bytes');
  assert.deepEqual(await policy.map('ffprobe', args), [...mediaInspectionPrefix, '/fixtures/current.flac']);
  for (const [binary, argv, options] of [['sh', args, {}], ['ffprobe', ['-version'], {}], ['ffprobe', args, { readonly: false }],
    ['ffprobe', [...mediaInspectionPrefix, join(directory, 'outside.flac')], {}]]) {
    await assert.rejects(policy.map(binary, argv, options), error => error.code.startsWith('fixture_media_'));
  }
  const outside = join(directory, 'outside'); await mkdir(outside); await writeFile(join(outside, 'file.flac'), 'outside');
  await symlink(outside, join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(policy.map('ffprobe', [...mediaInspectionPrefix, join(root, 'link', 'file.flac')]), { code: 'fixture_media_path_refused' });
  await rename(root, join(directory, 'retired')); await mkdir(root); await writeFile(source, 'replacement');
  await assert.rejects(policy.map('ffprobe', args), { code: 'fixture_media_root_changed' });
}));

test('close seals serial admission, shares completion and drains held startup and inspection', () => fixture(async ({ root, args }) => {
  const started = gate(); const startHold = gate(); const inspected = gate(); const commandHold = gate(); const calls = [];
  const executor = createOwnedMediaInspectionExecutor({ workspaceDir: root, createTransport: () => ({
    start: async () => { calls.push('start'); started.release(); await startHold.promise; },
    run: async () => { calls.push('run'); inspected.release(); await commandHold.promise; return { stdout: 'current' }; },
    retire: async () => { calls.push('retire'); }, remove: async () => { calls.push('remove'); },
  }) });
  const run = executor.run('ffprobe', args); await started.promise;
  assert.equal(executor.canRemoveWorkspace(), false);
  const queued = executor.run('ffprobe', args);
  await assert.rejects(executor.run('ffprobe', args), { code: 'fixture_media_admission_closed' });
  const closing = executor.close(); assert.equal(executor.close(), closing);
  await assert.rejects(executor.run('ffprobe', args), { code: 'fixture_media_admission_closed' });
  assert.deepEqual(calls, ['start']); startHold.release(); await inspected.promise;
  assert.deepEqual(calls, ['start', 'run']); commandHold.release();
  assert.equal((await run).stdout, 'current'); assert.equal((await queued).stdout, 'current'); await closing;
  assert.deepEqual(calls, ['start', 'run', 'run', 'retire', 'remove']); assert.equal(executor.canRemoveWorkspace(), true);
}));

for (const primary of [new Error('private-original'), null]) {
  test(`failed inspection preserves ${primary === null ? 'null' : 'Error'} through retirement failure and retains its workspace`, () => fixture(async ({ root, args }) => {
    let stops = 0; let commands = 0; let removed = false; const cleanup = new Error('controlled-stop-failure');
    const executor = createOwnedMediaInspectionExecutor({ workspaceDir: root, createTransport: () => ({
      start: async () => {}, run: async () => { commands++; throw primary; },
      retire: async () => { stops++; throw cleanup; }, remove: async () => { removed = true; },
    }) });
    const first = assert.rejects(executor.run('ffprobe', args), error => error === primary);
    const queued = assert.rejects(executor.run('ffprobe', args), error => error === primary);
    await Promise.all([first, queued]); assert.equal(commands, 1);
    await assert.rejects(executor.close(), error => error === cleanup);
    assert.equal(stops, 1); assert.equal(removed, false); assert.equal(executor.canRemoveWorkspace(), false);
  }));
}

test('pre-cancellation never creates an owner and keeps null cancellation', () => fixture(async ({ root, args }) => {
  const controller = new AbortController(); controller.abort(null);
  const executor = createOwnedMediaInspectionExecutor({ workspaceDir: root, signal: controller.signal,
    createTransport: () => assert.fail('No transport before admission') });
  await assert.rejects(executor.run('ffprobe', args), error => error === null); await executor.close();
  assert.equal(executor.canRemoveWorkspace(), true);
}));

test('invalid command admission does not create a container', () => fixture(async ({ root }) => {
  const executor = createOwnedMediaInspectionExecutor({ workspaceDir: root,
    createTransport: () => assert.fail('Invalid command must refuse before creation') });
  await assert.rejects(executor.run('ffprobe', ['-version']), { code: 'fixture_media_command_refused' });
  await executor.close(); assert.equal(executor.canRemoveWorkspace(), true);
}));

test('unacknowledged startup remains unsafe through canonical close without removal', () => fixture(async ({ root, args }) => {
  const original = new Error('controlled-start-failure'); const cleanup = new Error('unknown-owner'); let removed = false;
  const executor = createOwnedMediaInspectionExecutor({ workspaceDir: root, createTransport: () => ({
    start: async () => { throw original; }, retire: async () => { throw cleanup; }, remove: async () => { removed = true; },
  }) });
  await assert.rejects(executor.run('ffprobe', args), error => error === original);
  await assert.rejects(executor.close(), error => error === cleanup);
  assert.equal(executor.canRemoveWorkspace(), false); assert.equal(removed, false);
}));

test('verified container removal does not authorize deleting a replacement workspace', () => fixture(async ({ directory, root, args }) => {
  let removed = false;
  const executor = createOwnedMediaInspectionExecutor({ workspaceDir: root, createTransport: () => ({
    start: async () => {}, run: async () => ({}), retire: async () => {}, remove: async () => { removed = true; },
  }) });
  await executor.run('ffprobe', args); await rename(root, join(directory, 'original')); await mkdir(root);
  await assert.rejects(executor.close(), { code: 'fixture_media_root_changed' });
  assert.equal(removed, true); assert.equal(executor.canRemoveWorkspace(), false);
}));

function dockerControl(root, { createReply, execFailure, activeExec = false, changeIdentity = false } = {}) {
  const calls = []; const id = 'a'.repeat(64); const image = `sha256:${'b'.repeat(64)}`; let running = false; let token;
  const executeFileFn = async (binary, args, options) => {
    assert.equal(binary, 'docker'); assert.equal(options.shell, false); assert.equal(options.windowsHide, true);
    assert.equal(options.maxBuffer, 2 * 1024 * 1024); assert.ok(options.timeout > 0 && options.timeout <= 30_000);
    calls.push(args);
    switch (args[0]) {
      case 'image': return { stdout: image };
      case 'create': token = args[args.indexOf('--label') + 1].split('=')[1]; return { stdout: createReply ?? id };
      case 'start': running = true; return { stdout: id };
      case 'stop': running = false; return { stdout: id };
      case 'rm': assert.equal(running, false); return { stdout: id };
      case 'exec': if (execFailure) throw execFailure; return { stdout: 'current', stderr: '' };
      case 'inspect': return { stdout: JSON.stringify([{ Id: changeIdentity ? 'c'.repeat(64) : id, Image: image,
        Config: { Labels: { 'io.harmoniarr.fixture.media-owner': token }, Entrypoint: ['sleep'], Cmd: ['infinity'], Healthcheck: { Test: ['NONE'] } },
        HostConfig: { NetworkMode: 'none', ReadonlyRootfs: true, RestartPolicy: { Name: 'no' }, Privileged: false,
          CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges'], Mounts: [{ Type: 'bind', Source: root, Target: '/fixtures', ReadOnly: true, BindOptions: { NonRecursive: true } }] },
        Mounts: [{ Destination: '/fixtures', RW: false }], State: { Running: running }, ExecIDs: activeExec && running ? ['held'] : null }]) };
      default: assert.fail('Unreviewed Docker command');
    }
  };
  return { calls, executeFileFn, id };
}

test('transport pins the image, verifies effective isolation and targets only acknowledged identity', () => fixture(async ({ root }) => {
  const control = dockerControl(root); const transport = createOwnedMediaDockerTransport({ root, image: 'fixture:local', ...control });
  await transport.start(); assert.equal((await transport.run([...mediaInspectionPrefix, '/fixtures/current.flac'])).stdout, 'current');
  await transport.retire(); await transport.remove();
  const create = control.calls.find(args => args[0] === 'create');
  assert.ok(create.includes(`sha256:${'b'.repeat(64)}`)); assert.ok(!create.includes('fixture:local'));
  for (const args of control.calls.filter(row => ['exec', 'start', 'stop', 'inspect', 'rm'].includes(row[0]))) assert.ok(args.includes(control.id));
}));

test('unknown creation or changed ownership never authorizes guessed cleanup', () => fixture(async ({ root }) => {
  for (const options of [{ createReply: 'partial-id' }, { changeIdentity: true }]) {
    const control = dockerControl(root, options); const transport = createOwnedMediaDockerTransport({ root, image: 'fixture:local', ...control });
    await assert.rejects(transport.start()); await assert.rejects(transport.retire()); await assert.rejects(transport.remove());
    assert.equal(control.calls.some(args => ['stop', 'rm'].includes(args[0])), false);
  }
}));

test('a running exec refuses admission even when the container is healthy', () => fixture(async ({ root }) => {
  const control = dockerControl(root, { activeExec: true }); const transport = createOwnedMediaDockerTransport({ root, image: 'fixture:local', ...control });
  await transport.start(); await assert.rejects(transport.run(['-version']), { code: 'fixture_media_not_quiescent' });
  assert.equal(control.calls.some(args => args[0] === 'exec'), false); await transport.retire(); await transport.remove();
}));

test('API reads retain the identical owner, isolation and active-exec policy', () => fixture(async ({ root }) => {
  for (const options of [{}, { activeExec: true }, { changeIdentity: true }, { createReply: 'partial-id' }]) {
    const control = dockerControl(root, options); let closed = false;
    const transport = createOwnedMediaDockerTransport({ root, image: 'fixture:local', ...control, inspectionReadMode: 'api',
      createInspectionReader: async () => ({ inspect: async id => JSON.parse((await control.executeFileFn('docker', ['inspect', id],
        { timeout: 30_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true, shell: false })).stdout)[0],
      close: async () => { closed = true; } }),
    });
    if (options.changeIdentity || options.createReply) {
      await assert.rejects(transport.start()); await assert.rejects(transport.retire()); await assert.rejects(transport.remove());
      assert.equal(control.calls.some(args => ['stop', 'rm'].includes(args[0])), false);
    } else {
      await transport.start();
      if (options.activeExec) await assert.rejects(transport.run(['-version']), { code: 'fixture_media_not_quiescent' });
      else assert.equal((await transport.run([...mediaInspectionPrefix, '/fixtures/current.flac'])).stdout, 'current');
      await transport.retire(); await transport.remove();
    }
    await transport.closeReader(); assert.equal(closed, true);
  }
}));

for (const reason of [new Error('original-read-failure'), null]) {
  test(`failed cleanup disposes the reader without replacing original ${reason === null ? 'null' : 'Error'}`, () => fixture(async ({ root, args }) => {
    let closed = false; const cleanup = new Error('cleanup');
    const executor = createOwnedMediaInspectionExecutor({ workspaceDir: root, inspectionReadMode: 'api', createTransport: () => ({
      start: async () => {}, run: async () => { throw reason; }, retire: async () => { throw cleanup; }, remove: () => assert.fail(),
      closeReader: async () => { closed = true; throw null; },
    }) });
    await assert.rejects(executor.run('ffprobe', args), error => error === reason);
    await assert.rejects(executor.close(), error => error === cleanup); assert.equal(closed, true); assert.equal(executor.canRemoveWorkspace(), false);
  }));
}

test('a refused API bootstrap never creates an owner and canonical close can release the unchanged root', () => fixture(async ({ root, args }) => {
  const refused = new Error('unsupported-endpoint'); const calls = [];
  const executor = createOwnedMediaInspectionExecutor({ workspaceDir: root, image: 'fixture:local', inspectionReadMode: 'api',
    createTransport: input => createOwnedMediaDockerTransport({ ...input, executeFileFn: async (...argv) => { calls.push(argv); },
      createInspectionReader: async () => { throw refused; } }),
  });
  await assert.rejects(executor.run('ffprobe', args), error => error === refused); await executor.close();
  assert.equal(calls.length, 0); assert.equal(executor.canRemoveWorkspace(), true);
}));
