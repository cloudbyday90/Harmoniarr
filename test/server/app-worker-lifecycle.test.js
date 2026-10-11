/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { withIntegrationAppWorkerDrain } from '../../testing/integration/app-worker-lifecycle.js';
import { createFixturePhaseObserver } from '../../testing/integration/fixture-phase-observer.js';

test('app drain awaits the concrete worker receiver and preserves the scenario result', async () => {
  const gate = Promise.withResolvers();
  const entered = Promise.withResolvers();
  const phases = [];
  const worker = { close() { assert.strictEqual(this, worker); entered.resolve(); return gate.promise; } };
  const result = {};
  const pending = withIntegrationAppWorkerDrain({ application: { importCandidateModule: { importCandidateApplyWorker: worker } },
    phaseObserver: createFixturePhaseObserver({ onRecord: record => phases.push(record) }) }, async () => result);
  await entered.promise;
  try { assert.equal(phases.length, 0); }
  finally { gate.resolve(); }
  assert.strictEqual(await pending, result);
  assert.equal(phases[0].phase, 'app_worker_drain');
  assert.equal(phases[0].outcome, 'passed');
});

for (const primary of [new Error('scenario error'), null]) {
  test(`scenario ${primary === null ? 'null' : 'Error'} wins over worker cleanup failure`, async () => {
    const cleanup = new Error('cleanup failure');
    const application = { importCandidateModule: { importCandidateApplyWorker: { close: async () => { throw cleanup; } } } };
    await assert.rejects(withIntegrationAppWorkerDrain({ application, phaseObserver: createFixturePhaseObserver() },
      async () => { throw primary; }), error => error === primary);
  });
}

test('worker cleanup failure rejects an otherwise successful scenario including null', async () => {
  await assert.rejects(withIntegrationAppWorkerDrain({
    application: { importCandidateModule: { importCandidateApplyWorker: { close: async () => { throw null; } } } },
    phaseObserver: createFixturePhaseObserver(),
  }, async () => 'success'), error => error === null);
});
