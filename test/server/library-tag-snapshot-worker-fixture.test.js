/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createOperationRunLeaseFixture } from '../../testing/operation-run-lease-fixtures.js';
import { createFixtureGate, waitForFixtureReady } from '../../testing/integration/fixture-lifecycle.js';
import { createScopedFixtureGate, withFixtureWorkScope } from '../../testing/integration/fixture-work-scope.js';
import { startLibraryTagSnapshotFixtureWorker } from '../../testing/integration/library-tag-snapshot-worker-fixture.js';

function fixture() {
  const run = { id: '10000000-0000-4000-8000-000000000002' };
  const requestedRoot = resolve('.tmp', 'controlled-tag-unit-root');
  const rootId = '10000000-0000-4000-8000-000000000003';
  const file = { id: '10000000-0000-4000-8000-000000000004', libraryRootId: rootId,
    canonicalPath: join(requestedRoot, 'track.wav'), relativePath: 'track.wav', filename: 'track.wav',
    extension: '.wav', sizeBytes: 100, modifiedAt: '2026-10-10T00:00:00.000Z', fileState: 'observed' };
  const lease = createOperationRunLeaseFixture({ runId: run.id, jobType: 'library_scan' });
  const writes = []; const lifecycle = [];
  const context = { run, requestedRoot,
    scanCatalogue: { recordLibraryScanCatalogue: async () => ({ files: [file], libraryRootId: rootId, observedFileCount: 1 }) },
    tagOwner: { writeOwnedLibraryFileTagSnapshot: async (input) => { writes.push(input); } },
  };
  const runs = {
    acquireLease: async () => lease,
    markRunStarted: async () => true,
    executeScan: async ({ onFile }) => { await onFile(file); return { libraryRoot: requestedRoot, filesSeen: 1 }; },
    markRunCompleted: async () => { lifecycle.push('completed'); return true; },
    markRunFailed: async () => { lifecycle.push('failed'); return true; },
    markRunCancelled: async () => { lifecycle.push('cancelled'); return true; },
    releaseLease: async (input) => { assert.equal(input.expectedLease, lease); lifecycle.push('released'); return true; },
  };
  const parseFileFn = async () => ({ common: { title: 'Controlled title' }, format: { codec: 'PCM', sampleRate: 8000, bitsPerSample: 16 }, native: {} });
  return { context, runs, parseFileFn, writes, lifecycle, lease };
}

test('a current observed tag worker retains its captured lease, native payload and downstream observations', async () => {
  const f = fixture(); let job;
  await withFixtureWorkScope({}, async (scope) => {
    job = await startLibraryTagSnapshotFixtureWorker(f.context, f.runs, {}, { scope, parseFileFn: f.parseFileFn });
    await job.done;
  });
  assert.equal(job.lease(), f.lease);
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].payload.status, 'extracted');
  assert.equal(f.writes[0].payload.normalizedTags.title, 'Controlled title');
  assert.equal(job.artwork.length, 1);
  assert.deepEqual(job.downstream, ['sidecar', 'matching', 'releases', 'wanted', 'discovery']);
  assert.deepEqual(f.lifecycle, ['completed', 'released']);
});

test('genuine parser rejection still reaches exactly one failed snapshot without artwork', async () => {
  const f = fixture(); let job;
  await withFixtureWorkScope({}, async (scope) => {
    job = await startLibraryTagSnapshotFixtureWorker(f.context, f.runs, {}, { scope,
      parseFileFn: async () => { throw new Error('Controlled media parser failure'); } });
    await job.done;
  });
  assert.equal(f.writes.length, 1); assert.equal(f.writes[0].payload.status, 'failed');
  assert.equal(job.artwork.length, 0);
});

test('hook Error and null failures cannot become failed snapshots and preserve primary identity over rejected release', async () => {
  for (const primary of [new Error('Controlled hook assertion'), null]) {
    const f = fixture(); const entered = createFixtureGate(); let job;
    f.runs.releaseLease = async () => { f.lifecycle.push('release attempted'); throw new Error('Controlled secondary release failure'); };
    await assert.rejects(withFixtureWorkScope({}, async (scope) => {
      job = await startLibraryTagSnapshotFixtureWorker(f.context, f.runs,
        { afterParse: async () => { throw primary; } }, { scope, parseFileFn: f.parseFileFn });
      await job.waitForReady(entered.promise);
    }), (error) => error === primary);
    assert.equal(f.writes.length, 0); assert.equal(job.artwork.length, 0);
    assert.deepEqual(job.downstream, []); assert.deepEqual(f.lifecycle, ['failed', 'release attempted']);
  }
});

test('controlled parsed cancellation drains actual release before finalizers and prevents owning writes', async (t) => {
  const f = fixture(); const controller = new AbortController(); const entered = createFixtureGate();
  const primary = new Error('Controlled held tag cancellation'); const order = []; let job;
  f.runs.releaseLease = async () => { order.push('actual release'); return true; };
  const operation = withFixtureWorkScope({ signal: controller.signal }, async (scope) => {
    scope.onAfterDrain(() => { order.push('after drain'); });
    const hold = createScopedFixtureGate(scope);
    job = await startLibraryTagSnapshotFixtureWorker(f.context, f.runs, { afterParse: async () => {
      entered.release(); await hold.promise;
    } }, { scope, parseFileFn: f.parseFileFn });
    await job.done;
  });
  operation.catch(() => {});
  await waitForFixtureReady({ ready: entered.promise, operation, signal: t.signal }); controller.abort(primary);
  await assert.rejects(operation, (error) => error === primary);
  assert.deepEqual(order, ['actual release', 'after drain']);
  assert.equal(f.writes.length, 0); assert.equal(job.artwork.length, 0); assert.deepEqual(job.downstream, []);
  assert.deepEqual(f.lifecycle, ['cancelled']);
});

test('refused acquisition makes readiness unreachable without invoking a foreign release', async () => {
  const f = fixture(); const ready = createFixtureGate();
  f.runs.acquireLease = async () => null;
  f.runs.releaseLease = async () => assert.fail('No acquired lease can be released');
  await withFixtureWorkScope({}, async (scope) => {
    const job = await startLibraryTagSnapshotFixtureWorker(f.context, f.runs, {}, { scope, parseFileFn: f.parseFileFn });
    await assert.rejects(job.waitForReady(ready.promise), (error) => error.code === 'fixture_operation_completed_before_ready');
    await job.done;
  });
  assert.equal(f.writes.length, 0);
});

test('rejected acquisition is surfaced before readiness without a lease release or late write', async () => {
  const f = fixture(); const primary = new Error('Controlled acquisition failure'); const ready = createFixtureGate();
  f.runs.acquireLease = async () => { throw primary; };
  f.runs.releaseLease = async () => assert.fail('Rejected acquisition owns no lease');
  await assert.rejects(withFixtureWorkScope({}, async (scope) => {
    const job = await startLibraryTagSnapshotFixtureWorker(f.context, f.runs, {}, { scope, parseFileFn: f.parseFileFn });
    await job.waitForReady(ready.promise);
  }), (error) => error === primary);
  assert.equal(f.writes.length, 0);
});

test('factory and startup failure settle registered completion without launching tag persistence', async () => {
  for (const stage of ['factory', 'startup']) {
    const f = fixture(); const primary = new Error(`Controlled ${stage} failure`); let registered = false;
    await assert.rejects(withFixtureWorkScope({}, async (scope) => {
      await startLibraryTagSnapshotFixtureWorker(f.context, f.runs, {}, {
        scope: { ...scope, track(promise) { registered = true; return scope.track(promise); } },
        parseFileFn: f.parseFileFn, createWorkerFn: () => {
          assert.equal(registered, true);
          if (stage === 'factory') throw primary;
          return { startWorkerRun: async () => { throw primary; } };
        },
      });
    }), (error) => error === primary);
    assert.equal(f.writes.length, 0);
  }
});

test('pre-aborted and closed tag scopes admit no new worker', async () => {
  for (const reason of [new Error('Controlled pre-abort'), null]) {
    const f = fixture(); const controller = new AbortController(); controller.abort(reason); let launches = 0;
    await assert.rejects(startLibraryTagSnapshotFixtureWorker(f.context, f.runs, {}, {
      scope: { signal: controller.signal, track: () => assert.fail('Aborted scope registered work') },
      parseFileFn: f.parseFileFn, createWorkerFn: () => { launches += 1; },
    }), (error) => error === reason);
    assert.equal(launches, 0);
  }
  let scope; await withFixtureWorkScope({}, async (current) => { scope = current; });
  const f = fixture(); let launches = 0;
  await assert.rejects(startLibraryTagSnapshotFixtureWorker(f.context, f.runs, {}, { scope, parseFileFn: f.parseFileFn,
    createWorkerFn: () => { launches += 1; } }));
  assert.equal(launches, 0);
});
