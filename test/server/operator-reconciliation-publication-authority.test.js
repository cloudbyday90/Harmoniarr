/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { isDeepStrictEqual } from 'node:util';
import { createOperatorReconciliationPublicationService } from '../../src/server/metadata/operator-reconciliation-publication-service.js';
import { captureReconciliationPublication, captureReconciliationPublicationSource } from '../../src/server/metadata/operator-reconciliation-publication-policy.js';
import { createOperatorArtistReconciliationRequestService } from '../../src/server/metadata/operator-artist-reconciliation-request-service.js';
import { createReconciliationPublicationFixture } from '../../testing/operator-reconciliation-publication-fixtures.js';

test('publication refuses forged eligibility against unchanged unmonitored source', async () => {
  const { input, authority, desiredRelease } = createReconciliationPublicationFixture();
  input.publicationSource = structuredClone(input.publicationSource);
  input.publicationSource.monitoring.isMonitored = false;
  const guard = createOperatorReconciliationPublicationService({ store: {
    lockContext: async () => {}, readSource: async () => input.publicationSource,
    readAuthority: async () => authority,
  } });
  assert.equal(desiredRelease.eligibleForDownstreamWork, true);
  await assert.rejects(guard.assertCurrent({ prepared: guard.capture(input), desiredRelease,
    artistName: input.artistName, queryable: {} }), { code: 'operator_artist_reconciliation_publication_stale' });
});

for (const invalid of [undefined, null, {}, { operationType: 'metadata_artist_refresh' }]) {
  test(`missing or invalid acquisition ${JSON.stringify(invalid)} refuses before checkout`, async () => {
    const fixture = createReconciliationPublicationFixture(); const service = createOperatorArtistReconciliationRequestService({ getPoolFn: () => assert.fail('invalid publication must not checkout') });
    await assert.rejects(service.materializeDesiredReleaseRequests({ ...fixture.input, workerContext: invalid }), { code: 'operator_artist_reconciliation_publication_invalid' });
  });
}
test('capture owns context, nullable snapshot and normalized source independently of caller mutation', () => {
  const fixture = createReconciliationPublicationFixture(); const input = structuredClone(fixture.input); const prepared = captureReconciliationPublication(input);
  input.workerContext.expectedLease.acquisitionId = 'changed'; input.publicationSource.snapshot.snapshotPayload.consent = {};
  input.publicationSource.monitoring.monitoredReleaseGroupTypes.push('ep');
  assert.equal(prepared.expectedLease.acquisitionId, fixture.authority.lease.acquisitionId); assert.equal(prepared.source.snapshot.snapshotPayload.consent, null);
  assert.deepEqual(prepared.source.monitoring.monitoredReleaseGroupTypes, ['album']);
  const changed = structuredClone(prepared.source); changed.snapshot.snapshotPayload.consent = {};
  assert.equal(isDeepStrictEqual(prepared.source, changed), false);
  const source = captureReconciliationPublicationSource({ ...fixture, releaseGroupSelections: [], trackOverrides: [],
    snapshot: { id: fixture.input.snapshotId, snapshotRevision: 1, snapshotPayload: { consent: undefined } } });
  assert.equal(isDeepStrictEqual(prepared.source, source), false);
});

for (const changed of ['lease', 'expiry', 'scope', 'status', 'cancelled', 'disabled', 'snapshot', 'policy', 'selection', 'override', 'target']) {
  test(`publication refuses changed ${changed} with bounded authority failure`, async () => {
    const { input, authority, desiredRelease } = createReconciliationPublicationFixture(); const source = structuredClone(input.publicationSource);
    if (changed === 'lease') authority.lease.acquisitionId = '30000000-0000-4000-8000-000000000001';
    if (changed === 'expiry') authority.now = Date.parse('2100-01-01');
    if (changed === 'scope') authority.run.summary.appUserId = '30000000-0000-4000-8000-000000000001';
    if (changed === 'status') authority.run.status = 'completed';
    if (changed === 'cancelled') authority.run.cancel_requested_at = '2026-10-12';
    if (changed === 'disabled') authority.actor.is_disabled = true;
    if (changed === 'snapshot') source.snapshot.snapshotRevision++;
    if (changed === 'policy') source.monitoring.isMonitored = false;
    if (changed === 'selection') source.releaseGroupSelections.push({ selectionState: 'unselected' });
    if (changed === 'override') source.trackOverrides.push({ isDesired: false });
    if (changed === 'target') desiredRelease.metadataReleaseGroupId = '30000000-0000-4000-8000-000000000001';
    const original = createReconciliationPublicationFixture().input;
    const guard = createOperatorReconciliationPublicationService({ store: { lockContext: async () => {}, readSource: async () => source, readAuthority: async () => authority } });
    const prepared = guard.capture(original);
    const code = ['lease', 'expiry', 'scope', 'status'].includes(changed) ? 'operation_run_lease_lost'
      : changed === 'cancelled' ? 'operation_run_cancelled' : 'operator_artist_reconciliation_publication_stale';
    await assert.rejects(guard.assertCurrent({ prepared, desiredRelease, artistName: input.artistName, queryable: {} }), { code });
  });
}
test('fresh database clock refuses expiry after returned source reads', async () => {
  const { input, authority, desiredRelease } = createReconciliationPublicationFixture(); let reads = 0;
  const guard = createOperatorReconciliationPublicationService({ store: { lockContext: async () => {}, readSource: async () => input.publicationSource,
    readAuthority: async () => ({ ...authority, now: ++reads === 1 ? authority.now : Date.parse('2100-01-01') }) } });
  await assert.rejects(guard.assertCurrent({ prepared: guard.capture(input), desiredRelease, artistName: input.artistName, queryable: {} }), { code: 'operation_run_lease_lost' });
  assert.equal(reads, 2);
});
for (const primary of [new Error('final refusal'), null]) {
  test(`final ${primary === null ? 'null' : 'Error'} guard rejection rolls back request/event and survives rollback failure`, async () => {
    const fixture = createReconciliationPublicationFixture(); const calls = []; let checks = 0; let discarded;
    const client = { query: async sql => { calls.push(sql); if (sql === 'ROLLBACK') throw new Error('rollback'); return { rows: [] }; }, release: error => { discarded = error; } };
    const guard = { capture: captureReconciliationPublication, lockContext: async () => { calls.push('lock'); },
      assertCurrent: async () => { calls.push('guard'); if (++checks === 3) throw primary; } };
    const service = createOperatorArtistReconciliationRequestService({ publicationGuard: guard, getPoolFn: () => ({ connect: async () => client }),
      findActiveDuplicateRequest: async () => null, createMediaRequest: async () => { calls.push('request'); return { id: 'request' }; },
      insertMediaRequestEvent: async () => { calls.push('event'); }, reconcileDiscoveryRequests: async () => assert.fail('rolled back request must not reconcile') });
    await assert.rejects(service.materializeDesiredReleaseRequests(fixture.input), error => error === primary);
    assert.ok(calls.indexOf('request') > calls.indexOf('guard')); assert.ok(calls.indexOf('event') < calls.lastIndexOf('guard'));
    assert.equal(calls.includes('COMMIT'), false); assert.equal(calls.at(-1), 'ROLLBACK'); assert.equal(discarded.message, 'rollback');
  });
}
