/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceUserTrustEvidenceService } from '../../src/server/activity/source-user-trust-evidence-service.js';

test('listSourceUserReputationIndex returns case-insensitive reputation rows', async () => {
  const service = createSourceUserTrustEvidenceService({
    listTrustSnapshot: async () => ([
      { failureCount: 2, successCount: 5, trustState: 'trusted', username: 'Trusted-Peer' },
      { failureCount: 4, isBlocked: true, successCount: 0, username: 'blocked-peer' },
    ]),
  });

  const reputationIndex = await service.listSourceUserReputationIndex({ usernames: ['trusted-peer', 'missing-peer'] });

  assert.equal(reputationIndex.size, 1);
  assert.deepEqual(reputationIndex.get('trusted-peer'), {
    failureCount: 2,
    successCount: 5,
    trustState: 'trusted',
    username: 'Trusted-Peer',
  });
});

test('recordSourceUserOutcomeEvidence appends a neutral row for new successful evidence', async (t) => {
  const replaceTrustSnapshot = t.mock.fn(async () => {});
  const service = createSourceUserTrustEvidenceService({
    listTrustSnapshot: async () => ([]),
    replaceTrustSnapshot,
  });

  const row = await service.recordSourceUserOutcomeEvidence({
    eventType: 'import_candidate_applied',
    outcome: 'success',
    reason: 'Imported cleanly',
    username: 'new-peer',
  });

  assert.equal(row.username, 'new-peer');
  assert.equal(row.trustState, 'neutral');
  assert.equal(row.successCount, 1);
  assert.equal(row.failureCount, 0);
  assert.equal(row.lastEvidenceOutcome, 'success');
  assert.equal(row.lastSuccessfulEventType, 'import_candidate_applied');
  assert.equal(Array.isArray(row.trustHistory), true);
  assert.equal(row.trustHistory[0].kind, 'delivery_evidence');
  assert.equal(replaceTrustSnapshot.mock.callCount(), 1);
});

test('recordSourceUserOutcomeEvidence preserves blocked rows while incrementing failure evidence', async (t) => {
  const replaceTrustSnapshot = t.mock.fn(async () => {});
  const service = createSourceUserTrustEvidenceService({
    listTrustSnapshot: async () => ([{
      blockReason: 'Fake FLAC labels',
      failureCount: 1,
      isBlocked: true,
      successCount: 3,
      trustState: 'blocked',
      username: 'bad-peer',
    }]),
    replaceTrustSnapshot,
  });

  const row = await service.recordSourceUserOutcomeEvidence({
    eventType: 'import_candidate_download_failed',
    outcome: 'failure',
    reason: 'Remote transfer failed',
    username: 'BAD-PEER',
  });

  assert.equal(row.username, 'bad-peer');
  assert.equal(row.trustState, 'blocked');
  assert.equal(row.successCount, 3);
  assert.equal(row.failureCount, 2);
  assert.equal(row.lastFailureEventType, 'import_candidate_download_failed');
  assert.equal(row.blockReason, 'Fake FLAC labels');
  assert.equal(replaceTrustSnapshot.mock.callCount(), 1);
});

test('recordSourceUserOutcomeEvidence records actor provenance in trust history', async () => {
  const service = createSourceUserTrustEvidenceService({
    listTrustSnapshot: async () => ([]),
    replaceTrustSnapshot: async () => {},
  });

  const row = await service.recordSourceUserOutcomeEvidence({
    actorUserId: 'admin-1',
    eventType: 'import_candidate_applied',
    outcome: 'success',
    reason: 'Imported cleanly',
    username: 'new-peer',
  });

  assert.equal(row.trustHistory[0].actorUserId, 'admin-1');
  assert.equal(row.trustHistory[0].reason, 'Imported cleanly');
});

test('recordSourceUserOutcomeEvidence compacts expired delivery_evidence entries', async (t) => {
  const replaceTrustSnapshot = t.mock.fn(async () => {});
  const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
  const service = createSourceUserTrustEvidenceService({
    listTrustSnapshot: async () => ([{
      failureCount: 1,
      successCount: 1,
      trustHistory: [
        { id: 'old-evidence', kind: 'delivery_evidence', occurredAt: oldDate, outcome: 'success' },
        { id: 'old-manual', kind: 'manual_override', occurredAt: oldDate, trustState: 'trusted' },
        { id: 'old-blocklist', kind: 'blocklist_event', occurredAt: oldDate, eventType: 'source_user_blocked' },
      ],
      trustState: 'neutral',
      username: 'aged-peer',
    }]),
    replaceTrustSnapshot,
  });

  const row = await service.recordSourceUserOutcomeEvidence({
    eventType: 'import_candidate_applied',
    outcome: 'success',
    username: 'aged-peer',
  });

  const ids = row.trustHistory.map((e) => e.id);
  assert.ok(!ids.includes('old-evidence'), 'expired delivery_evidence should be compacted');
  assert.ok(ids.includes('old-manual'), 'manual_override entries should be preserved regardless of age');
  assert.ok(ids.includes('old-blocklist'), 'blocklist_event entries should be preserved regardless of age');
});

test('recordSourceUserOutcomeEvidence calls onTrustThresholdCrossedFn when evidence degrades into watch', async (t) => {
  const onTrustThresholdCrossedFn = t.mock.fn(async () => {});
  const service = createSourceUserTrustEvidenceService({
    listTrustSnapshot: async () => ([{
      failureCount: 1,
      successCount: 1,
      trustState: 'neutral',
      username: 'borderline-peer',
    }]),
    onTrustThresholdCrossedFn,
    replaceTrustSnapshot: async () => {},
  });

  const row = await service.recordSourceUserOutcomeEvidence({
    eventType: 'import_candidate_download_failed',
    outcome: 'failure',
    reason: 'Transfer timed out',
    username: 'borderline-peer',
  });

  assert.equal(row.failureCount, 2);
  assert.equal(onTrustThresholdCrossedFn.mock.callCount(), 1);
  const callArgs = onTrustThresholdCrossedFn.mock.calls[0].arguments[0];
  assert.equal(callArgs.previousReviewState, 'normal');
  assert.equal(callArgs.reviewState, 'watch');
  assert.equal(callArgs.username, 'borderline-peer');
  assert.equal(callArgs.reason, 'Failures currently outweigh successes (2/3).');
});

test('recordSourceUserOutcomeEvidence does not call onTrustThresholdCrossedFn when already in watch', async (t) => {
  const onTrustThresholdCrossedFn = t.mock.fn(async () => {});
  const service = createSourceUserTrustEvidenceService({
    listTrustSnapshot: async () => ([{
      failureCount: 2,
      successCount: 1,
      trustState: 'neutral',
      username: 'watch-peer',
    }]),
    onTrustThresholdCrossedFn,
    replaceTrustSnapshot: async () => {},
  });

  await service.recordSourceUserOutcomeEvidence({
    eventType: 'import_candidate_download_failed',
    outcome: 'failure',
    reason: 'Transfer timed out',
    username: 'watch-peer',
  });

  assert.equal(onTrustThresholdCrossedFn.mock.callCount(), 0);
});

test('recordSourceUserOutcomeEvidence swallows onTrustThresholdCrossedFn errors', async () => {
  const service = createSourceUserTrustEvidenceService({
    listTrustSnapshot: async () => ([{
      failureCount: 1,
      successCount: 1,
      trustState: 'neutral',
      username: 'borderline-peer',
    }]),
    onTrustThresholdCrossedFn: async () => { throw new Error('dispatch failed'); },
    replaceTrustSnapshot: async () => {},
  });

  const row = await service.recordSourceUserOutcomeEvidence({
    eventType: 'import_candidate_download_failed',
    outcome: 'failure',
    username: 'borderline-peer',
  });

  assert.equal(row.username, 'borderline-peer');
});
