/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createFixtureGate } from '../../testing/integration/fixture-lifecycle.js';
import { withFixtureWorkScope } from '../../testing/integration/fixture-work-scope.js';
import { startReleaseReconciliationFixtureWorker } from '../../testing/integration/library-release-reconciliation-worker-fixture.js';

const base = () => ({ runId: 'controlled-release-scan', libraryRoot: 'controlled-root',
  observation: () => ({ fileState: 'observed' }), recordLibraryScanCatalogue: async () => ({ files: [], observedFileCount: 1 }),
  reconcileLibraryReleases: async () => {}, runs: { acquireLease: async () => ({ acquisitionId: 'original-capture' }),
    markRunStarted: async () => true, markRunFailed: async () => true, markRunCompleted: async () => true, releaseLease: async () => true } });

test('actual release fixture worker ending before coverage refuses unreachable readiness', async () => {
  const ready = createFixtureGate(); const failure = new Error('Controlled catalogue failure before coverage'); let failedMessage;
  await withFixtureWorkScope({}, async (scope) => {
    const input = base(); input.recordLibraryScanCatalogue = async () => { throw failure; };
    input.runs.markRunFailed = async ({ errorMessage }) => { failedMessage = errorMessage; return true; };
    const job = await startReleaseReconciliationFixtureWorker({ ...input, scope });
    const waiting = job.waitForReady(ready.promise).then((value) => ({ value }), (error) => ({ error }));
    await job.done; await setImmediate(); ready.release('bounded fallback');
    assert.equal((await waiting).error?.code, 'fixture_operation_completed_before_ready');
    assert.equal(failedMessage, failure.message); assert.deepEqual(job.later, []);
  });
});

test('release fixture adapter failure is observed instead of successful completion or a detached rejection', async () => {
  const failure = new Error('Controlled release adapter rejection');
  await assert.rejects(withFixtureWorkScope({}, async (scope) => {
    const input = base(); input.runs.releaseLease = async () => { throw failure; };
    const job = await startReleaseReconciliationFixtureWorker({ ...input, scope, createWorkerFn: (callbacks) => ({
      startWorkerRun: async () => {
        // Observe the deliberate old detached rejection in this bounded control.
        Promise.resolve().then(() => callbacks.releaseLease({ runId: input.runId })).catch(() => {});
      },
    }) });
    await job.done;
  }), (error) => error === failure);
});
