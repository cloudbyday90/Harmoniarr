/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createFixtureGate, withFixtureLifecycle } from '../../testing/integration/fixture-lifecycle.js';
import { startLibraryScanFixtureWorker } from '../../testing/integration/library-scan-worker-fixture.js';

const run = { runId: 'test-owned-scan', libraryRoot: 'test-owned-root' };
const outcome = (promise) => promise.then((value) => ({ value }), (error) => ({ error }));

test('an actual scan ending before metadata lookup refuses unreachable readiness without waiting for the case deadline', async () => {
  const ready = createFixtureGate(); const failure = new Error('Controlled scan failure before lookup');
  let recordedFailure; let released = false;
  const job = await startLibraryScanFixtureWorker({ run, callbacks: {
    acquireLease: async () => ({ acquisitionId: 'captured-test-acquisition' }),
    markRunStarted: async () => true,
    executeScan: async () => { throw failure; },
    recordLibraryScanCatalogue: async () => assert.fail('Catalogue cannot precede the failed walk'),
    markRunFailed: async (input) => { recordedFailure = input.errorMessage; return true; },
    releaseLease: async () => { released = true; return true; },
  } });
  const waiting = outcome(job.waitForReady(ready.promise));
  await job.done; await setImmediate();
  // Free the old fixture's readiness wait before its deliberately failing assertion.
  ready.release('fallback checkpoint');
  const result = await waiting;
  assert.equal(result.error?.code, 'fixture_operation_completed_before_ready');
  assert.equal(recordedFailure, failure.message);
  assert.equal(released, true);
});

test('the scan fixture preserves a rejected release adapter without leaking a detached rejection or reporting successful completion', async () => {
  const failure = new Error('Controlled scan release adapter failure');
  const job = await startLibraryScanFixtureWorker({ run, callbacks: {
    releaseLease: async () => { throw failure; },
  }, createWorkerFn: (callbacks) => ({ startWorkerRun: async () => {
    // Model detached production work, but observe its deliberate old-helper
    // rejection so this bounded red test does not crash the test process.
    Promise.resolve().then(() => callbacks.releaseLease({ runId: run.runId })).catch(() => {});
  } }) });
  await assert.rejects(job.done, (error) => error === failure);
});

test('a real scan without an acquisition settles its fixture completion without invoking release', async () => {
  const job = await startLibraryScanFixtureWorker({ run, callbacks: {
    acquireLease: async () => null,
    recordLibraryScanCatalogue: async () => assert.fail('An unowned scan cannot catalogue'),
    releaseLease: async () => assert.fail('No lease was acquired'),
  } });
  let finished = false;
  job.done.then(() => { finished = true; });
  await setImmediate();
  assert.equal(finished, true);
  await job.done;
});

test('cancellation releases a held actual scan and drains its release before fixture teardown', async () => {
  const controller = new AbortController(); const entered = createFixtureGate();
  const reason = new Error('Controlled held-scan cancellation'); const order = [];
  let writesAfterHold = 0;
  const operation = withFixtureLifecycle({ signal: controller.signal }, async (scope) => {
    const hold = createFixtureGate({ signal: scope.signal });
    scope.onRelease(() => { order.push('controlled release'); hold.release(); });
    const file = { fileState: 'observed', canonicalPath: 'test-owned-file' };
    const job = await startLibraryScanFixtureWorker({ run, signal: scope.signal, track: (promise) => scope.track(promise), callbacks: {
      acquireLease: async () => ({ acquisitionId: 'captured-test-acquisition' }),
      markRunStarted: async () => true,
      executeScan: async ({ onFile }) => { await onFile(file); return { libraryRoot: run.libraryRoot, filesSeen: 1 }; },
      recordLibraryScanCatalogue: async () => ({ files: [file], observedFileCount: 1, libraryRootId: 'controlled-root' }),
      matchLibraryFiles: async () => { entered.release(); await hold.promise; writesAfterHold += 1; },
      markRunFailed: async () => true,
      markRunCompleted: async () => assert.fail('The held cancelled scan cannot complete'),
      releaseLease: async () => { await setImmediate(); order.push('actual release drained'); return true; },
    } });
    await job.waitForReady(entered.promise);
    await createFixtureGate({ signal: scope.signal }).promise;
  });
  operation.catch(() => {});
  await entered.promise; controller.abort(reason);
  await assert.rejects(operation, (error) => error === reason);
  order.push('teardown permitted');
  assert.deepEqual(order, ['controlled release', 'actual release drained', 'teardown permitted']);
  assert.equal(writesAfterHold, 0);
});

test('a pre-aborted scan fixture preserves the exact cancellation reason and launches nothing', async () => {
  for (const reason of [new Error('Cancelled before scan startup'), null]) {
    const controller = new AbortController(); controller.abort(reason);
    let launches = 0;
    await startLibraryScanFixtureWorker({ run, signal: controller.signal,
      callbacks: { releaseLease: async () => true }, track: () => {},
      createWorkerFn: (callbacks) => { launches += 1; return { startWorkerRun: async () => callbacks.releaseLease() }; },
    }).then(() => assert.fail('A cancelled fixture launched'), (error) => assert.equal(error, reason));
    assert.equal(launches, 0);
  }
});

test('a closed fixture lifecycle refuses registration before a scan can launch', async () => {
  let closedScope;
  await withFixtureLifecycle({}, async (scope) => { closedScope = scope; });
  let launches = 0;
  await assert.rejects(startLibraryScanFixtureWorker({ run,
    callbacks: { releaseLease: async () => true }, track: (promise) => closedScope.track(promise),
    createWorkerFn: (callbacks) => { launches += 1; return { startWorkerRun: async () => callbacks.releaseLease() }; },
  }), /registered promise/u);
  assert.equal(launches, 0);
});

test('factory and startup rejection both settle the already registered completion before cleanup drains it', async () => {
  for (const failureStage of ['factory', 'startup']) {
    const failure = new Error(`Controlled ${failureStage} failure`); let registered;
    await assert.rejects(withFixtureLifecycle({}, async (scope) => {
      await startLibraryScanFixtureWorker({ run, callbacks: { releaseLease: async () => true },
        track: (promise) => { registered = promise; scope.track(promise); },
        createWorkerFn: () => {
          if (failureStage === 'factory') throw failure;
          return { startWorkerRun: async () => { throw failure; } };
        },
      });
    }), (error) => error === failure);
    assert.ok(registered);
    await assert.rejects(registered, (error) => error === failure);
  }
});
