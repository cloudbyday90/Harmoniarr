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

test('quality profiles expose cutoff, fallback, upgrade, and verification policy', () => {
  const lossless = resolveQualityProfile(QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE);
  const highQuality = resolveQualityProfile(QUALITY_PROFILE_CODES.HIGH_QUALITY);

  assert.deepEqual(lossless.cutoffFormats, ['flac', 'alac', 'wav']);
  assert.equal(lossless.fallbackAllowed, false);
  assert.equal(lossless.manualReviewBelowPreferred, true);
  assert.equal(lossless.requiresVerification, true);
  assert.equal(lossless.upgradeAllowed, false);

  assert.deepEqual(highQuality.cutoffFormats, ['flac', 'alac', 'wav']);
  assert.equal(highQuality.fallbackAllowed, true);
  assert.equal(highQuality.upgradeAllowed, true);
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

test('lossless archive downloads claimed FLAC but requires verification before automatic add', () => {
  const decision = evaluateQualityEvidence({
    candidate: { normalizedPayload: { codec: 'flac' } },
    profileCode: QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE,
  });

  assert.equal(decision.code, QUALITY_DECISION_CODES.NEEDS_VERIFICATION);
  assert.equal(decision.autoDownloadEligible, true);
  assert.equal(decision.autoAddEligible, false);
});

test('quality evaluation reads normalized extension arrays from candidates', () => {
  const decision = evaluateQualityEvidence({
    candidate: { normalizedPayload: { extensions: ['mp3'], bitrateKbps: 320 } },
    profileCode: QUALITY_PROFILE_CODES.HIGH_QUALITY,
  });

  assert.equal(decision.code, QUALITY_DECISION_CODES.ACCEPTED);
  assert.deepEqual(decision.formats, ['mp3']);
  assert.equal(decision.autoDownloadEligible, true);
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

test('release fallback override accepts high-quality lossy evidence without changing cutoff preference', () => {
  const decision = evaluateQualityEvidence({
    candidate: { normalizedPayload: { bitrateKbps: 320, codec: 'mp3' } },
    profileCode: QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE,
    qualityOverride: { mode: 'allow_fallback_quality' },
  });

  assert.equal(decision.code, QUALITY_DECISION_CODES.ACCEPTED);
  assert.equal(decision.fallbackOverrideActive, true);
  assert.equal(decision.profile.fallbackAllowed, true);
  assert.equal(decision.profile.upgradeAllowed, true);
  assert.deepEqual(decision.profile.cutoffFormats, ['flac', 'alac', 'wav']);
});

test('release fallback override still requires verification before automatically adding lossless claims', () => {
  const decision = evaluateQualityEvidence({
    candidate: { normalizedPayload: { codec: 'flac' } },
    profileCode: QUALITY_PROFILE_CODES.LOSSLESS_ARCHIVE,
    qualityOverride: { mode: 'allow_fallback_quality' },
  });

  assert.equal(decision.code, QUALITY_DECISION_CODES.NEEDS_VERIFICATION);
  assert.equal(decision.autoDownloadEligible, true);
  assert.equal(decision.autoAddEligible, false);
});
