import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateQualityEvidence,
  QUALITY_DECISION_CODES,
  QUALITY_PROFILE_CODES,
  resolveQualityProfile,
} from '../../src/server/acquisition/acquisition-quality-policy-service.js';

test('resolveQualityProfile defaults to lossless archive', () => {
  assert.equal(resolveQualityProfile('unknown').code, QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE);
});

test('lossless archive accepts verified FLAC evidence', () => {
  const decision = evaluateQualityEvidence({
    candidate: { normalizedPayload: { codec: 'flac' } },
    mediaVerification: { codec: 'flac' },
    profileCode: QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE,
  });

  assert.equal(decision.code, QUALITY_DECISION_CODES.ACCEPTED);
  assert.equal(decision.autoDownloadEligible, true);
  assert.equal(decision.autoAddEligible, true);
  assert.equal(decision.preferredMet, true);
});

test('lossless archive requires verification for claimed FLAC evidence', () => {
  const decision = evaluateQualityEvidence({
    candidate: { normalizedPayload: { codec: 'flac' } },
    profileCode: QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE,
  });

  assert.equal(decision.code, QUALITY_DECISION_CODES.NEEDS_VERIFICATION);
  assert.equal(decision.autoDownloadEligible, false);
});

test('lossless archive blocks lossy evidence before automatic handoff', () => {
  const decision = evaluateQualityEvidence({
    candidate: { normalizedPayload: { bitrateKbps: 320, codec: 'mp3' } },
    profileCode: QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE,
  });

  assert.equal(decision.code, QUALITY_DECISION_CODES.BELOW_MINIMUM);
  assert.equal(decision.autoDownloadEligible, false);
});

test('high quality accepts 320 kbps MP3 fallback evidence', () => {
  const decision = evaluateQualityEvidence({
    candidate: { normalizedPayload: { bitrateKbps: 320, codec: 'mp3' } },
    profileCode: QUALITY_PROFILE_CODES.HIGH_QUALITY,
  });

  assert.equal(decision.code, QUALITY_DECISION_CODES.ACCEPTED);
  assert.equal(decision.minimumMet, true);
});
