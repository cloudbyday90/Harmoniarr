/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { captureFixtureWorkspaceOwner } from '../../testing/integration/fixture-workspace-owner.js';
import { createLibraryAddMediaScenario, resolveLibraryAddMediaOptions } from '../../testing/integration/library-add-media-scenario.js';

const observer = { measure: (_phase, operation) => operation() };
const gate = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };
const fixtureAdapter = ({ inspectionExecutor } = {}) => ({
  verifyTooling: async () => null, getTooling: async () => ({ status: 'healthy' }),
  mediaCommand: (...args) => inspectionExecutor ? inspectionExecutor.run(...args) : Promise.resolve('per-command'),
  generateAudio: async () => 'generated',
});

test('cohort selection defaults conservatively and rejects invalid or imageless API mode before startup', () => {
  assert.deepEqual(resolveLibraryAddMediaOptions({}), { mode: 'per-command', mediaImage: undefined, diagnostics: false });
  for (const environment of [
    { HARMONIARR_LIBRARY_ADD_MEDIA_EXECUTION: 'api' },
    { HARMONIARR_LIBRARY_ADD_MEDIA_DIAGNOSTICS: 'yes' },
    { HARMONIARR_LIBRARY_ADD_MEDIA_EXECUTION: 'owned-api' },
    { HARMONIARR_LIBRARY_ADD_MEDIA_EXECUTION: 'owned-api', HARMONIARR_INTEGRATION_MEDIA_IMAGE: '  ' },
  ]) assert.throws(() => resolveLibraryAddMediaOptions(environment), TypeError);
});

test('default and local-tool paths keep the existing fixture and never create an owned executor', async () => {
  const records = [];
  const media = createLibraryAddMediaScenario({ createMediaFixture: fixtureAdapter,
    createExecutor: () => assert.fail(), onRecord: record => records.push(record) });
  assert.throws(() => media.mediaFixture.mediaCommand('ffprobe', []), /active scenario/u);
  await media.runScenario({ runScenario: async (work, options) => {
    assert.equal(await work({ workspaceDir: '/unused' }), 'per-command');
    assert.equal(await options.workspaceCleanupGuard(), true);
  } }, async () => {
    assert.equal(await media.mediaFixture.generateAudio('/unused/audio'), 'generated');
    return media.mediaFixture.mediaCommand('ffprobe', []);
  });
  assert.equal(records[0].inspections, 1); assert.equal(records[0].generations, 1);
  assert.equal(records[0].ownerCleanupSafe, null); assert.equal(records[0].transport, null);
});

test('actual close follows app drainage, holds the cleanup predicate and drains the database tail before reuse', async () => {
  const closeEntered = gate(); const closeHeld = gate(); const databaseTail = gate(); const events = []; let closes = 0;
  const records = []; const media = createLibraryAddMediaScenario({ mode: 'owned-api', mediaImage: 'controlled', createMediaFixture: fixtureAdapter,
    createExecutor: options => {
      assert.equal(options.workspaceDir, '/one'); assert.equal(options.inspectionReadMode, 'api');
      return { run: async () => 'measured', canRemoveWorkspace: () => events.includes('closed'),
        close: async () => { closes++; events.push('close'); closeEntered.release(); await closeHeld.promise; events.push('closed'); } };
    }, onRecord: record => { records.push(record); throw null; } });
  const runtime = { runScenario: async (work, options) => {
    const result = await work({ workspaceDir: '/one' }); events.push('app-drained');
    assert.equal(await options.workspaceCleanupGuard(), true); events.push('child-removed');
    await databaseTail.promise; return result;
  } };
  const operation = media.runScenario(runtime, () => media.mediaFixture.mediaCommand('ffprobe', []),
    { workspaceCleanupGuard: () => { events.push('caller-guard'); return true; } });
  await closeEntered.promise;
  assert.deepEqual(events, ['app-drained', 'close']);
  await assert.rejects(media.runScenario(runtime, () => assert.fail()), /serially/u);
  closeHeld.release();
  // Observe the real returned database tail, without relying on a timer.
  await Promise.resolve(); await Promise.resolve();
  await assert.rejects(media.runScenario(runtime, () => assert.fail()), /serially/u);
  databaseTail.release(); assert.equal(await operation, 'measured'); assert.equal(closes, 1);
  assert.deepEqual(events, ['app-drained', 'close', 'closed', 'caller-guard', 'child-removed']);
  assert.equal(records[0].ownerCleanupSafe, true); assert.equal(records[0].inspections, 1);
  assert.throws(() => media.mediaFixture.mediaCommand('ffprobe', []), /active scenario/u);
});

for (const primary of [new Error('original scenario'), null]) {
  test(`failed owner close retains child and parent while preserving original ${primary === null ? 'null' : 'Error'}`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'harmoniarr-media-cohort-')); const owner = await captureFixtureWorkspaceOwner(root);
    let retained; let releases = 0; let failClose = true; const executorRoots = [];
    const media = createLibraryAddMediaScenario({ mode: 'owned-api', mediaImage: 'controlled', createMediaFixture: fixtureAdapter,
      createExecutor: ({ workspaceDir }) => { executorRoots.push(workspaceDir); const unsafe = failClose;
        return { canRemoveWorkspace: () => !unsafe, close: async () => { if (unsafe) throw new Error('uncertain close'); } }; } });
    const runtime = { runScenario: (work, options) => owner.withScenario({ name: 'same', observer, guard: options.workspaceCleanupGuard },
      workspaceDir => withWorkerTaskCleanup(() => work({ workspaceDir }), async () => { releases++; })) };
    try {
      await assert.rejects(media.runScenario(runtime, async ({ workspaceDir }) => {
        retained = workspaceDir; await writeFile(join(workspaceDir, 'evidence'), 'retained'); throw primary;
      }), error => error === primary);
      failClose = false; await media.runScenario(runtime, async () => 'healthy sibling');
      assert.notEqual(executorRoots[0], executorRoots[1]); assert.equal(releases, 2);
      await assert.rejects(owner.finish({ observer, guard: () => true, release: async () => { releases++; } }), error => error === primary);
      assert.equal(releases, 3); await access(join(retained, 'evidence')); await access(root);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
}

test('successful body cannot grant cleanup after failed close or nonboolean safety, and caller refusal is retained', async () => {
  for (const variant of ['close-failure', 'nonboolean', 'caller-refusal']) {
    const failure = new Error('close failed'); let closed = false; let callerCalls = 0;
    const media = createLibraryAddMediaScenario({ mode: 'owned-api', mediaImage: 'controlled', createMediaFixture: fixtureAdapter,
      createExecutor: () => ({ close: async () => { closed = true; if (variant === 'close-failure') throw failure; },
        canRemoveWorkspace: () => variant === 'nonboolean' ? 'true' : true }) });
    const runtime = { runScenario: async (work, options) => {
      await work({ workspaceDir: '/controlled' });
      const safe = await options.workspaceCleanupGuard(); assert.equal(closed, true); assert.equal(safe, false);
      throw Object.assign(new Error('retained'), { code: 'controlled_retention' });
    } };
    await assert.rejects(media.runScenario(runtime, async () => 'complete', { workspaceCleanupGuard: () => { callerCalls++; return false; } }),
      error => variant === 'close-failure' ? error === failure : error.code === 'controlled_retention');
    assert.equal(closed, true); assert.equal(callerCalls, variant === 'caller-refusal' ? 1 : 0);
  }
});
