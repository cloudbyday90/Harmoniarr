/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidatePreflightReviewService } from '../../src/server/import-candidates/import-candidate-preflight-review-service.js';

test('preflight review publishes only a bounded category through the owning transition and transaction', async () => {
  const calls = []; const queryable = { query() {} }; const candidate = { id: 'candidate' };
  const service = createImportCandidatePreflightReviewService({ markImportCandidateImportBlocked: async input => { calls.push(input); } });
  for (const [code, reason] of [['safe_auto_spectral_transcoded', 'suspicious_lossless'], ['safe_auto_quality_below_minimum', 'lossy_audio'],
    ['safe_auto_spectral_proof_unavailable', 'audio_check_failed']]) {
    assert.deepEqual(await service.recordPreparedLibraryAddReview({ prepared: { candidate,
      qualityGate: { eligible: false, blockers: [{ code, filename: '/private/file.flac', message: 'private tool output' }] } }, queryable }),
    { outcome: 'review_recorded', recoveryReasonCode: reason });
    const saved = calls.at(-1); assert.equal(saved.queryable, queryable); assert.equal(saved.recoveryReasonCode, reason);
    assert.equal(saved.importCandidateId, candidate.id); assert.equal(saved.addBlockerCode, 'media_verification');
    assert.doesNotMatch(JSON.stringify(saved), /private|qualityGate|qualityOverride|recordSourceFailure/u);
  }
});

test('an absent, positive or unmeasured gate cannot create a quality-review record', async () => {
  let calls = 0;
  const service = createImportCandidatePreflightReviewService({ markImportCandidateImportBlocked: async () => { calls += 1; } });
  for (const qualityGate of [null, {}, { eligible: true, blockers: [{ code: 'blocked' }] }, { eligible: false, blockers: [] }]) {
    assert.deepEqual(await service.recordPreparedLibraryAddReview({ prepared: { qualityGate } }), { outcome: 'not_available' });
  }
  assert.equal(calls, 0);
});

for (const error of [new Error('required publication rejected'), null]) test(`preflight review preserves ${error === null ? 'null' : 'Error'} publication refusal`, async () => {
  const service = createImportCandidatePreflightReviewService({ markImportCandidateImportBlocked: async () => { throw error; } });
  await assert.rejects(service.recordPreparedLibraryAddReview({ prepared: { candidate: { id: 'candidate' }, qualityGate: {
    eligible: false, blockers: [{ code: 'safe_auto_spectral_transcoded' }] } }, queryable: { query() {} } }), value => value === error);
});
