/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateOutcomePublisher, settleCandidateOutcomeAdvisory } from '../../src/server/import-candidates/import-candidate-outcome-publication-service.js';
import { assertDatabasePublicationScope } from '../../src/server/database-publication-scope.js';
import { createSourceUserTrustEvidenceService } from '../../src/server/activity/source-user-trust-evidence-service.js';

const input = { candidate: { username: 'peer' }, event: { id: 'event-1', eventType: 'import_candidate_download_failed',
  occurredAt: new Date('2026-10-23T10:00:00Z'), reason: 'fixture' }, queryable: { query: async () => ({ rows: [] }) }, outcome: 'failure' };

test('candidate publisher expires its facade and returns advisories without running them', async () => {
  let owned; let notified = false;
  const result = await createImportCandidateOutcomePublisher({ recordOutcome: async event => {
    owned = event.queryable;
    assertDatabasePublicationScope(owned, { kind: 'import_candidate_event', ownerId: input.event.id });
    assert.notEqual(owned, input.queryable);
    assert.equal(event.id, input.event.id);
    assert.throws(() => assertDatabasePublicationScope(owned, { kind: 'import_candidate_event', ownerId: 'foreign' }), TypeError);
    return { recorded: true, afterCommit: () => { notified = true; } };
  } })(input);
  assert.equal(notified, false);
  assert.throws(() => owned.query('SELECT 1'), TypeError);
  await settleCandidateOutcomeAdvisory(result); assert.equal(notified, true);
});

for (const failure of [new Error('fixture refusal'), null]) {
  test(`candidate publisher preserves ${failure === null ? 'null' : 'Error'} and expires failed authority`, async () => {
    let owned;
    await assert.rejects(createImportCandidateOutcomePublisher({ recordOutcome: async event => {
      owned = event.queryable; throw failure;
    } })(input), error => error === failure);
    assert.throws(() => owned.query('SELECT 1'), TypeError);
  });
}

test('candidate publisher refuses a missing identity, sink or acknowledgement', async () => {
  for (const result of [null, {}, { recorded: false }]) {
    await assert.rejects(createImportCandidateOutcomePublisher({ recordOutcome: async () => result })(input), /not recorded/u);
  }
  await assert.rejects(createImportCandidateOutcomePublisher({ recordOutcome: null })(input), TypeError);
  await assert.rejects(createImportCandidateOutcomePublisher()({ ...input, event: {} }), TypeError);
});

test('borrowed candidate evidence refuses raw clients and non-transactional snapshot adapters', async () => {
  const service = createSourceUserTrustEvidenceService({ appendOutcomeEventFn: async () => ({ id: 'event-1' }) });
  await assert.rejects(service.recordSourceUserOutcomeEvidence({ ...input.event, username: 'peer', outcome: 'failure', queryable: input.queryable }), TypeError);
  await assert.rejects(createImportCandidateOutcomePublisher({ recordOutcome: service.recordSourceUserOutcomeEvidence })(input), /Transactional trust snapshot mutation/u);
});
