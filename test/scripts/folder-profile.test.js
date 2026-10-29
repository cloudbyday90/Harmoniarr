/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseFolderProfileCommand, createFolderProfilePlan } from '../../testing/performance/folder-profile-policy.js';
import { measureFolderProfileWork, parseFolderProfileCgroup } from '../../testing/performance/folder-profile-memory.js';
import { withFolderProfileContainer } from '../../testing/performance/folder-profile-docker.js';
import { removeFolderProfileFixture } from '../../testing/performance/folder-profile-fixture.js';
import { createFolderProfileWorkload } from '../../testing/performance/folder-profile-workload.js';

const image = 'sha256:' + 'a'.repeat(64), owner = randomUUID();
const args = ['--image', image, '--output', 'profile.json', '--storage', 'volume'];
test('profile policy requires explicit immutable storage and rejects unknown, duplicate and unsafe options', () => {
  const selection = parseFolderProfileCommand(args); assert.equal(selection.repeats, 3); assert.deepEqual(selection.cases, ['small', 'large']);
  for (const invalid of [[], [...args, '--image', image], [...args, '--root', 'x'], [...args, '--scratch-root', 'C:/scratch'],
    [...args, '--cases', '../private'], [...args, '--cases', 'small,small'], [...args, '--repeats', '0'], [...args, '--repeats', '6'],
    ['--image', 'latest', '--output', 'x.json', '--storage', 'volume'], ['--image', image, '--output', 'x.json', '--storage', 'bind']]) assert.throws(() => parseFolderProfileCommand(invalid));
});
test('sample plan alternates algorithms and keeps sampling controls separately identified', () => {
  const plan = createFolderProfilePlan({ cases: ['small', 'large'], repeats: 2 });
  assert.equal(plan.length, 20); assert.deepEqual(plan.slice(0, 4).map(row => row.algorithm), ['stream', 'readdir', 'readdir', 'stream']);
  const controls = plan.filter(row => !row.observed); assert.equal(controls.length, 4);
  assert.ok(controls.every(row => row.caseName === 'large' && row.pages === 3));
});
const memory = value => ({ rss: value, heapUsed: value, heapTotal: value, external: value, arrayBuffers: value });
test('cgroup v1 and v2 retain precision/swap semantics and reject unbounded counters', () => {
  const v1 = parseFolderProfileCgroup(['10', '20', '1073741824', '1073741824', 'oom_kill 0\nunder_oom 0', '200000', '100000', 'nr_throttled 3'], 1);
  const v2 = parseFolderProfileCgroup(['10', '20', '1073741824', '0', 'oom_kill 0', '200000 100000', 'nr_throttled 3'], 2);
  assert.equal(v1.currentPrecision, 'approximate-v1'); assert.equal(v2.currentPrecision, 'cgroup-current');
  assert.equal(v1.swapMaxBytes, 0); assert.equal(v2.swapMaxBytes, 0); assert.equal(v1.cpus, 2); assert.equal(v2.cpus, 2);
  assert.throws(() => parseFolderProfileCgroup(['10', '20', 'max', '0', 'oom_kill 0', '200000 100000', 'nr_throttled 3'], 2));
});
test('measurement keeps signed fields, RSS sampling and KiB lifetime high-water marks separate', async () => {
  let callback, cleared = false, reads = 0, clock = 0, gc = 0;
  const result = await measureFolderProfileWork(async () => { callback(); clock = 12; return 'done'; }, {
    collect: () => { gc++; }, readMemory: () => memory([100, 90, 80][reads++]), readRss: () => 140,
    readResource: () => ({ maxRSS: 200 }), cpu: () => ({ user: 3, system: 2 }), now: () => clock,
    schedule: fn => { callback = fn; return 7; }, cancel: id => { assert.equal(id, 7); cleared = true; },
  });
  assert.equal(cleared, true); assert.equal(gc, 2); assert.equal(result.elapsedMs, 12);
  assert.equal(result.delta.heapUsed, -10); assert.equal(result.retainedDelta.heapUsed, -20); assert.equal(result.sampledPeakRss, 140);
  assert.equal(result.lifetimeMaxRssAfterBytes, 200 * 1024); assert.equal(result.rssSamples, 2);
});
test('work failure including null is preserved while the sampling timer is retired', async () => {
  for (const original of [null, new Error('work')]) {
    let stopped = false, caught, rejected = false;
    try { await measureFolderProfileWork(async () => { throw original; }, { collect: () => {}, readMemory: () => memory(1),
      readResource: () => ({ maxRSS: 1 }), cpu: () => ({}), schedule: () => 1, cancel: () => { stopped = true; throw new Error('cleanup'); } }); }
    catch (error) { caught = error; rejected = true; }
    assert.equal(rejected, true); assert.equal(caught, original); assert.equal(stopped, true);
  }
});

test('sampling-off controls create no timer and still retain boundary snapshots', async () => {
  let scheduled = false;
  const result = await measureFolderProfileWork(async () => 'done', { observed: false, collect: () => {},
    readMemory: () => memory(100), readRss: () => 105, readResource: () => ({ maxRSS: 1 }), cpu: () => ({}), schedule: () => { scheduled = true; } });
  assert.equal(scheduled, false); assert.equal(result.intervalMs, null); assert.equal(result.rssSamples, 1); assert.equal(result.sampledPeakRss, 105);
});
test('workload verifies independent page data and preserves explicit refusal after a completed page', async () => {
  let calls = 0; const cursors = [];
  const createService = () => ({ browse: async ({ cursor }) => {
    cursors.push(cursor); const offset = calls++ * 100;
    if (offset === 100) throw Object.assign(new Error('private native text'), { code: 'folder_browse_timeout' });
    return { entries: Array.from({ length: 100 }, (_, index) => ({ name: 'folder-' + String(offset + index).padStart(5, '0') })), page: { total: 1000, nextCursor: 'next' } };
  } });
  const result = await createFolderProfileWorkload({ createService, path: '/unused', caseName: 'small', algorithm: 'stream', pages: 3 })();
  assert.deepEqual(cursors, [undefined, 'next']); assert.equal(result.completedPages, 1); assert.equal(result.status, 'refused'); assert.equal(result.refusal, 'folder_browse_timeout');
  assert.equal(JSON.stringify(result).includes('private'), false);
  const invalid = createFolderProfileWorkload({ createService: () => ({ browse: async () => ({ entries: [{ name: 'wrong' }], page: { total: 1000 } }) }), path: '/unused', caseName: 'small', algorithm: 'stream', pages: 1 });
  await assert.rejects(invalid, error => error.code === 'ERR_ASSERTION');
});
test('read/stat observers preserve the original native Promise identity', async () => {
  for (const bufferSize of [32, 128]) {
    const nativeRead = Promise.resolve(null), nativeStat = Promise.resolve({}); let observer;
    createFolderProfileWorkload({ path: '/unused', caseName: 'small', algorithm: 'stream', bufferSize, pages: 1,
      filesystem: { stat: () => nativeStat, opendir: async (_path, options) => {
        assert.deepEqual(options, { bufferSize }); return { read: () => nativeRead, close: async () => {} };
      } }, createService: dependencies => { observer = dependencies; return {}; } });
    assert.equal(observer.readStat('/unused'), nativeStat);
    const directory = await observer.openDirectory('/unused', { bufferSize: 32 }); assert.equal(directory.read(), nativeRead); await directory.close();
  }
});

function dockerFixture({ startFailure, abortBeforeStart, removalFailure = false } = {}) {
  const id = 'b'.repeat(64), calls = []; let status = 'created';
  const controller = new AbortController();
  const record = () => ({ Id: id, Image: image, Config: { User: '1000:1000', Labels: { 'harmoniarr.folder-profile': owner } },
    HostConfig: { Memory: 1024 ** 3, MemorySwap: 1024 ** 3, NanoCpus: 2_000_000_000, ReadonlyRootfs: true, NetworkMode: 'none', CapDrop: ['ALL'], SecurityOpt: ['no-new-privileges:true'] },
    Mounts: [{ Destination: '/app/benchmark', RW: false }], State: { Status: status, Running: status === 'running', ExitCode: 0, OOMKilled: false } });
  const docker = async command => {
    calls.push(command[0]);
    if (command[0] === 'create') { if (abortBeforeStart) controller.abort(); return id; }
    if (command[0] === 'inspect') return JSON.stringify([record()]);
    if (command[0] === 'start') { status = 'running'; if (startFailure !== undefined) throw startFailure; status = 'exited'; return JSON.stringify({ owner, phase: 'probe', result: {} }); }
    if (command[0] === 'kill') { status = 'exited'; return id; }
    if (command[0] === 'wait') return '0';
    if (command[0] === 'rm') { if (removalFailure) throw new Error('remove'); return id; }
    if (command[0] === 'ps') return '';
    throw new Error('Unexpected Docker operation');
  };
  return { calls, controller, docker };
}
test('owned container failure retires the running process before removal and preserves Error/null', async () => {
  for (const original of [null, new Error('start')]) {
    const fixture = dockerFixture({ startFailure: original }); let retired = false, caught;
    try { await withFolderProfileContainer({ args: [], command: ['--expose-gc', 'worker.js'], image, owner, docker: fixture.docker, onRetired: () => { retired = true; } }); }
    catch (error) { caught = error; }
    assert.equal(caught, original); assert.equal(retired, true);
    assert.ok(fixture.calls.indexOf('kill') < fixture.calls.indexOf('wait')); assert.ok(fixture.calls.indexOf('wait') < fixture.calls.indexOf('rm'));
  }
});
test('cancellation during creation skips launch and retires a never-started container without waiting', async () => {
  const fixture = dockerFixture({ abortBeforeStart: true }); let retired = false;
  await assert.rejects(withFolderProfileContainer({ args: [], command: ['--expose-gc', 'worker.js'], image, owner, signal: fixture.controller.signal, docker: fixture.docker, onRetired: () => { retired = true; } }), error => error.name === 'AbortError');
  assert.equal(fixture.calls.includes('start'), false); assert.equal(fixture.calls.includes('wait'), false); assert.equal(retired, true);
});
test('failed removal cannot acknowledge retirement or mask the original failure', async () => {
  const original = new Error('start'), fixture = dockerFixture({ startFailure: original, removalFailure: true }); let retired = false;
  await assert.rejects(withFolderProfileContainer({ args: [], command: ['--expose-gc', 'worker.js'], image, owner, docker: fixture.docker, onRetired: () => { retired = true; } }), error => error === original);
  assert.equal(retired, false);
});
test('fixture cleanup refuses a changed ownership marker and preserves its files', async () => {
  const parent = await realpath(await mkdtemp(join(tmpdir(), 'harmoniarr-profile-guard-'))), root = join(parent, owner);
  assert.equal(dirname(parent), await realpath(tmpdir()));
  try {
    await mkdir(root); await writeFile(join(root, '.fixture.json'), JSON.stringify({ version: 1, owner: randomUUID(), cases: ['small'] }));
    await assert.rejects(removeFolderProfileFixture({ parent, owner }));
    assert.ok(await readFile(join(root, '.fixture.json'), 'utf8'));
  } finally { assert.equal(dirname(root), parent); await rm(parent, { recursive: true, force: false }); }
});
test('valid fixture cleanup removes only the owned UUID directory', async () => {
  const parent = await realpath(await mkdtemp(join(tmpdir(), 'harmoniarr-profile-clean-'))), root = join(parent, owner);
  assert.equal(dirname(parent), await realpath(tmpdir()));
  try {
    await mkdir(root); await writeFile(join(root, '.fixture.json'), JSON.stringify({ version: 1, owner, cases: ['small'] }));
    await writeFile(join(parent, 'sibling'), 'preserve');
    assert.deepEqual(await removeFolderProfileFixture({ parent, owner }), { ownedFixtureRemoved: true });
    assert.equal(await readFile(join(parent, 'sibling'), 'utf8'), 'preserve');
  } finally { assert.equal(dirname(root), parent); await rm(parent, { recursive: true, force: false }); }
});
