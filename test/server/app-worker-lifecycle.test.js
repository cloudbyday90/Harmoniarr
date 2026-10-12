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
import { drainApplicationWorkerOwners } from '../../src/server/application-worker-drain.js';

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

test('app drain waits for apply before scan, drains scan after apply null and preserves both receivers', async () => {
  const applyGate = Promise.withResolvers(); const applyEntered = Promise.withResolvers();
  const scanGate = Promise.withResolvers(); const scanEntered = Promise.withResolvers(); let settled = false; let scanCalled = false;
  const apply = { close() { assert.equal(this, apply); applyEntered.resolve(); return applyGate.promise; } };
  const scan = { close() { assert.equal(this, scan); scanCalled = true; scanEntered.resolve(); return scanGate.promise; } };
  const pending = withIntegrationAppWorkerDrain({ application: { importCandidateModule: { importCandidateApplyWorker: apply },
    libraryModule: { libraryScanWorker: scan } }, phaseObserver: createFixturePhaseObserver() }, async () => 'result');
  void pending.then(() => { settled = true; }, () => { settled = true; });
  await applyEntered.promise; assert.equal(scanCalled, false);
  applyGate.reject(null); await scanEntered.promise; assert.equal(settled, false);
  scanGate.reject(new Error('scan fallout')); await assert.rejects(pending, error => error === null);
  assert.equal(settled, true);
});

test('application drain captures all eleven receivers and attempts every known owner after metadata null', async () => {
  const gate = Promise.withResolvers(); const entered = Promise.withResolvers(); const calls = [];
  const metadata = { close() { assert.equal(this, metadata); calls.push('metadata'); entered.resolve(); return gate.promise; } };
  const intake = { close() { assert.equal(this, intake); calls.push('intake'); throw new Error('intake fallout'); } };
  const provider = { close() { assert.equal(this, provider); calls.push('provider'); throw new Error('provider fallout'); } };
  const requestDiscovery = { close() { assert.equal(this, requestDiscovery); calls.push('requestDiscovery'); throw new Error('request discovery fallout'); } };
  const discovery = { close() { assert.equal(this, discovery); calls.push('discovery'); throw new Error('discovery fallout'); } };
  const execution = { close() { assert.equal(this, execution); calls.push('execution'); throw new Error('execution fallout'); } };
  const inspection = { close() { assert.equal(this, inspection); calls.push('inspection'); throw new Error('inspection fallout'); } };
  const transcode = { close() { assert.equal(this, transcode); calls.push('transcode'); throw new Error('transcode fallout'); } };
  const apply = { close() { assert.equal(this, apply); calls.push('apply'); throw new Error('apply fallout'); } };
  const scan = { close() { assert.equal(this, scan); calls.push('scan'); return Promise.reject(new Error('scan fallout')); } };
  const organize = { close() { assert.equal(this, organize); calls.push('organize'); throw new Error('organize fallout'); } };
  const application = { importCandidateModule: { importCandidateExecutionWorker: execution, importCandidateMediaInspectionWorker: inspection,
    importCandidateTranscodeWorker: transcode, importCandidateApplyWorker: apply },
    metadataModule: { metadataArtistRefreshWorker: metadata },
    libraryModule: { libraryExternalIntakeWorker: intake, libraryProviderIngestExecutionWorker: provider, libraryExternalRequestDiscoveryWorker: requestDiscovery,
      libraryDiscoveryWorker: discovery, libraryOrganizeApplyWorker: organize, libraryScanWorker: scan } };
  const pending = drainApplicationWorkerOwners(application); void pending.catch(() => {}); await entered.promise;
  application.importCandidateModule = {}; application.libraryModule = {}; application.metadataModule = {};
  assert.deepEqual(calls, ['metadata']); gate.reject(null);
  await assert.rejects(pending, error => error === null); assert.deepEqual(calls, ['metadata', 'intake', 'provider', 'requestDiscovery', 'discovery', 'execution', 'inspection', 'transcode', 'apply', 'organize', 'scan']);
});

for (const primary of [new Error('inspection cleanup'), null]) {
  test(`inspection ${primary === null ? 'null' : 'Error'} remains primary while apply and scan drain`, async () => {
    const calls = [];
    const application = { importCandidateModule: {
      importCandidateExecutionWorker: { close: async () => { calls.push('execution'); } },
      importCandidateMediaInspectionWorker: { close: async () => { calls.push('inspection'); throw primary; } },
      importCandidateApplyWorker: { close: async () => { calls.push('apply'); throw new Error('apply fallout'); } },
    }, libraryModule: { libraryScanWorker: { close: async () => { calls.push('scan'); throw new Error('scan fallout'); } } } };
    await assert.rejects(drainApplicationWorkerOwners(application), error => error === primary);
    assert.deepEqual(calls, ['execution', 'inspection', 'apply', 'scan']);
  });
}

for (const primary of [new Error('provider cleanup'), null]) {
  test(`provider ${primary === null ? 'null' : 'Error'} remains primary while discovery and scan drain`, async () => {
    const calls = [];
    const application = { libraryModule: {
      libraryProviderIngestExecutionWorker: { close: async () => { calls.push('provider'); throw primary; } },
      libraryDiscoveryWorker: { close: async () => { calls.push('discovery'); throw new Error('discovery fallout'); } },
      libraryScanWorker: { close: async () => { calls.push('scan'); } },
    } };
    await assert.rejects(drainApplicationWorkerOwners(application), error => error === primary);
    assert.deepEqual(calls, ['provider', 'discovery', 'scan']);
  });
}

for (const primary of [new Error('request discovery cleanup'), null]) {
  test(`request discovery ${primary === null ? 'null' : 'Error'} stays primary while global discovery and scan drain`, async () => {
    const calls = [];
    const application = { libraryModule: {
      libraryExternalRequestDiscoveryWorker: { close: async () => { calls.push('requestDiscovery'); throw primary; } },
      libraryDiscoveryWorker: { close: async () => { calls.push('discovery'); throw new Error('discovery fallout'); } },
      libraryScanWorker: { close: async () => { calls.push('scan'); } },
    } };
    await assert.rejects(drainApplicationWorkerOwners(application), error => error === primary);
    assert.deepEqual(calls, ['requestDiscovery', 'discovery', 'scan']);
  });
}

for (const primary of [new Error('metadata cleanup'), null]) {
  test(`metadata ${primary === null ? 'null' : 'Error'} stays primary while all following library owners drain`, async () => {
    const calls = [];
    const application = { metadataModule: { metadataArtistRefreshWorker: { close: async () => { calls.push('metadata'); throw primary; } } }, libraryModule: {
      libraryExternalIntakeWorker: { close: async () => { calls.push('intake'); throw new Error('intake fallout'); } },
      libraryScanWorker: { close: async () => { calls.push('scan'); } },
    } };
    await assert.rejects(drainApplicationWorkerOwners(application), error => error === primary);
    assert.deepEqual(calls, ['metadata', 'intake', 'scan']);
  });
}

for (const primary of [new Error('organize cleanup'), null]) {
  test(`organize ${primary === null ? 'null' : 'Error'} remains primary while scan drains`, async () => {
    const calls = [];
    const application = { libraryModule: {
      libraryOrganizeApplyWorker: { close: async () => { calls.push('organize'); throw primary; } },
      libraryScanWorker: { close: async () => { calls.push('scan'); throw new Error('scan fallout'); } },
    } };
    await assert.rejects(drainApplicationWorkerOwners(application), error => error === primary);
    assert.deepEqual(calls, ['organize', 'scan']);
  });
}

for (const primary of [new Error('transcode cleanup'), null]) {
  test(`transcode ${primary === null ? 'null' : 'Error'} remains primary while apply and scan drain`, async () => {
    const calls = [];
    const application = { importCandidateModule: {
      importCandidateTranscodeWorker: { close: async () => { calls.push('transcode'); throw primary; } },
      importCandidateApplyWorker: { close: async () => { calls.push('apply'); throw new Error('apply fallout'); } },
    }, libraryModule: { libraryScanWorker: { close: async () => { calls.push('scan'); throw new Error('scan fallout'); } } } };
    await assert.rejects(drainApplicationWorkerOwners(application), error => error === primary);
    assert.deepEqual(calls, ['transcode', 'apply', 'scan']);
  });
}
