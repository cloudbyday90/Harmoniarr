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
import { startLibraryScanCatalogueFixtureWorker } from '../../testing/integration/library-scan-catalogue-worker-fixture.js';

const base = () => ({ runId: 'catalogue-worker-control', requestedRoot: 'catalogue-root-control',
  recordLibraryScanCatalogue: async () => ({ files: [], observedFileCount: 0 }),
  executeScanFn: async () => ({ libraryRoot: 'catalogue-root-control', filesSeen: 0 }),
  runs: { acquireLease: async () => ({ acquisitionId: 'captured-original' }), markRunStarted: async () => true,
    markRunCompleted: async () => true, markRunFailed: async () => true, markRunCancelled: async () => true,
    releaseLease: async () => true } });

test('a real catalogue worker failing before the walk checkpoint refuses unreachable readiness', async () => {
  const ready = createFixtureGate(); const failure = new Error('Controlled walk failure before readiness'); let recorded;
  await withFixtureWorkScope({}, async (scope) => {
    const input = base(); input.executeScanFn = async () => { throw failure; };
    input.runs.markRunFailed = async ({ errorMessage }) => { recorded = errorMessage; return true; };
    const job = await startLibraryScanCatalogueFixtureWorker({ ...input, scope, afterWalk: () => ready.release() });
    const waiting = job.waitForReady(ready.promise).then((value) => ({ value }), (error) => ({ error }));
    await job.done; await setImmediate(); ready.release('bounded fallback');
    assert.equal((await waiting).error?.code, 'fixture_operation_completed_before_ready');
    assert.equal(recorded, failure.message); assert.deepEqual(job.downstream, []);
  });
});

test('a catalogue fixture release rejection is observed as the original error rather than successful completion', async () => {
  const failure = new Error('Controlled catalogue lease release rejection');
  await assert.rejects(withFixtureWorkScope({}, async (scope) => {
    const input = base(); input.runs.releaseLease = async () => { throw failure; };
    const job = await startLibraryScanCatalogueFixtureWorker({ ...input, scope, createWorkerFn: (callbacks) => ({
      startWorkerRun: async () => {
        // Keep the deliberate legacy detached rejection observed in this bounded red control.
        Promise.resolve().then(() => callbacks.releaseLease({ runId: input.runId })).catch(() => {});
      },
    }) });
    await job.done;
  }), (error) => error === failure);
});

test('a catalogue hook failure remains primary after the actual lease release rejects', async () => {
  for (const primary of [new Error('Controlled catalogue walk hook assertion'), null]) {
    let released = false;
    await assert.rejects(withFixtureWorkScope({}, async (scope) => {
      const input = base(); input.runs.releaseLease = async () => { released = true; throw new Error('Secondary release fallout'); };
      const job = await startLibraryScanCatalogueFixtureWorker({ ...input, scope, afterWalk: async () => { throw primary; } });
      await job.done;
    }), (error) => error === primary);
    assert.equal(released, true);
  }
});

test('fixture cancellation after a successful walk hold stops before the catalogue owner', async () => {
  const controller = new AbortController(); const reason = new Error('Controlled catalogue pre-write cancellation'); let writes = 0;
  await assert.rejects(withFixtureWorkScope({ signal: controller.signal }, async (scope) => {
    const input = base(); input.recordLibraryScanCatalogue = async () => { writes += 1; return { files: [] }; };
    const job = await startLibraryScanCatalogueFixtureWorker({ ...input, scope, afterWalk: async () => { controller.abort(reason); } });
    await job.done;
  }), (error) => error === reason);
  assert.equal(writes, 0);
});

test('non-Error owner failures retain original identity while SQL Errors remain recorded domain outcomes', async () => {
  let releases = 0;
  await withFixtureWorkScope({}, async (scope) => {
    const input = base(); input.recordLibraryScanCatalogue = async () => { throw null; };
    input.runs.releaseLease = async () => { releases += 1; return true; };
    const job = await startLibraryScanCatalogueFixtureWorker({ ...input, scope }); await job.done;
  }).then(() => assert.fail('A null owner failure was lost'), (error) => assert.equal(error, null));
  assert.equal(releases, 1);
  const sqlFailure = new Error('Controlled ordinary catalogue SQL failure'); let recorded;
  await withFixtureWorkScope({}, async (scope) => {
    const input = base(); input.recordLibraryScanCatalogue = async () => { throw sqlFailure; };
    input.runs.markRunFailed = async ({ errorMessage }) => { recorded = errorMessage; return true; };
    const job = await startLibraryScanCatalogueFixtureWorker({ ...input, scope }); await job.done;
    assert.deepEqual(job.downstream, []);
  });
  assert.equal(recorded, sqlFailure.message);
});
