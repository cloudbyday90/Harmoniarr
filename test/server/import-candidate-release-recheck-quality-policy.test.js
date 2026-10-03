import assert from 'node:assert/strict';
import test from 'node:test';
import { buildRecheckQualityContext } from '../../src/server/import-candidates/import-candidate-release-recheck-quality-policy.js';
const wantedReleaseId = '00000000-0000-4000-8000-000000000001';
const consent = { mode: 'allow_fallback_quality', wantedReleaseId };
const candidate = { normalizedPayload: { musicQueue: { wantedReleaseId, profileCode: 'lossless_archive', qualityOverride: consent } } };
test('recheck retains strict base verification and respects fresh higher floors and revoked consent', async () => {
  const participant = { wantedReleaseId, appUserId: 'user-1', qualityPreferences: { minimumQuality: 'high', preferredFormat: 'flac' }, qualityOverride: consent };
  const allowed = await buildRecheckQualityContext({ candidate, participants: [participant] });
  assert.equal(allowed.profileCode, 'lossless_archive');
  assert.equal(allowed.minimumBitrateKbps, 320);
  assert.equal(allowed.qualityOverride.minimumBitrateKbps, 320);
  const revoked = await buildRecheckQualityContext({ candidate, participants: [{ ...participant, qualityOverride: null }] });
  assert.equal(revoked.qualityOverride, null);
  assert.equal(revoked.minimumBitrateKbps, 320);
});
test('valid empty preference objects preserve Any while unknown or disabled policy remains strict', async () => {
  const anyCandidate = { normalizedPayload: { musicQueue: { wantedReleaseId, profileCode: 'any_available' } } };
  const participant = { wantedReleaseId, appUserId: 'user-1', qualityPreferences: {} };
  assert.equal((await buildRecheckQualityContext({ candidate: anyCandidate, participants: [participant] })).profileCode, 'any_available');
  assert.equal((await buildRecheckQualityContext({ candidate: anyCandidate, participants: [{ ...participant, qualityPreferences: null }] })).profileCode, 'lossless_archive');
  assert.equal((await buildRecheckQualityContext({ candidate, participants: [{ ...participant, isDisabled: true, qualityOverride: consent }] })).qualityOverride, null);
});

test('shared recheck preserves the acquired primary recipient while sorting membership for exact set guards', async () => {
  const primaryId = '00000000-0000-4000-8000-000000000002';
  const shared = { normalizedPayload: { musicQueue: { profileCode: 'high_quality', wantedReleaseId: primaryId,
    wantedReleaseIds: [primaryId, wantedReleaseId], sharedOperatorDiscovery: true },
  requestOwnership: { sourceRequestedForUserId: 'primary-user' } } };
  const result = await buildRecheckQualityContext({ candidate: shared,
    participants: [{ wantedReleaseId, appUserId: 'other-user', qualityPreferences: {} },
      { wantedReleaseId: primaryId, appUserId: 'primary-user', qualityPreferences: {} }] });
  assert.equal(result.wantedReleaseId, primaryId);
  assert.deepEqual(result.wantedReleaseIds, [wantedReleaseId, primaryId]);
  assert.equal(shared.normalizedPayload.requestOwnership.sourceRequestedForUserId, 'primary-user');
});
