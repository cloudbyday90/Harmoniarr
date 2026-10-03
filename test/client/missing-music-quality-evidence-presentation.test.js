/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMissingMusicQualityEvidencePresentation } from '../../src/client/lib/missing-music-quality-evidence-presentation.js';

function createDetail() {
  return {
    decision: { requestedFor: { accountStatus: 'active', username: 'Jamie' } },
    permissions: { canAllowFallbackQuality: true, isReadOnly: false },
    qualityEvidence: {
      code: 'below_minimum', profileCode: 'lossless_archive', formats: ['mp3'], bitrateKbps: 128,
      preferredFormats: ['flac'], minimumFormats: ['flac', 'alac', 'wav'], minimumBitrateKbps: null,
      requiresVerification: true, verifiedLossless: false, fallbackAllowed: false, fallbackOverrideActive: false,
    },
  };
}

function facts(presentation) {
  return Object.fromEntries(presentation.facts.map(({ label, value }) => [label, value]));
}

test('quality evidence displays the current preference without approving a below-minimum match', () => {
  const presentation = buildMissingMusicQualityEvidencePresentation(createDetail());
  assert.deepEqual(facts(presentation), {
    Profile: 'Lossless archive', Decision: 'Below preference', 'Observed formats': 'MP3', Bitrate: '128 kbps',
    'Preferred formats': 'FLAC', Minimum: 'FLAC, ALAC, WAV', 'Lossless proof': 'Required',
    'Lossless verification': 'Not verified', Fallback: 'Not allowed',
  });
  assert.equal(presentation.canAllowFallbackQuality, true);
  assert.equal(presentation.recipientNote, 'This choice applies to this release for Jamie. Other household recipients’ quality requirements still apply.');
});

test('fallback permission is server-derived and disabled history remains read-only', () => {
  const detail = createDetail();
  detail.permissions.canAllowFallbackQuality = false;
  detail.qualityEvidence.code = 'needs_verification';
  assert.equal(buildMissingMusicQualityEvidencePresentation(detail).canAllowFallbackQuality, false);
  detail.permissions.canAllowFallbackQuality = true;
  detail.permissions.isReadOnly = true;
  assert.equal(buildMissingMusicQualityEvidencePresentation(detail).canAllowFallbackQuality, false);
  detail.permissions.isReadOnly = false;
  detail.decision.requestedFor.accountStatus = 'disabled';
  assert.equal(buildMissingMusicQualityEvidencePresentation(detail).canAllowFallbackQuality, false);
});

test('known tiers, scoped consent, and lossy minimum remain distinct from completed verification', () => {
  for (const [profileCode, label] of [['high_quality', 'High quality'], ['any_available', 'Any available']]) {
    const detail = createDetail();
    Object.assign(detail.qualityEvidence, {
      profileCode, fallbackAllowed: true, fallbackOverrideActive: true, minimumBitrateKbps: 256,
      requiresVerification: false,
      minimumFormats: ['flac', 'mp3', 'aac', 'opus', 'ogg'],
    });
    const values = facts(buildMissingMusicQualityEvidencePresentation(detail));
    assert.equal(values.Profile, label);
    assert.equal(values.Minimum, 'FLAC, MP3, AAC, Opus, Ogg · lossy audio 256 kbps or higher');
    assert.equal(values.Fallback, 'Allowed for this recipient');
    assert.equal(values['Lossless proof'], 'Not required by this profile');
    assert.equal(values['Lossless verification'], 'Not verified');
  }
});

test('unknown quality facts use bounded public labels instead of defaulting a profile or echoing raw evidence', () => {
  const detail = createDetail();
  detail.qualityEvidence = {
    code: 'private_provider_error', profileCode: '/mnt/downloads/private', formats: ['__proto__', 'private-path'],
    bitrateKbps: Infinity, preferredFormats: [], minimumFormats: [], minimumBitrateKbps: -1,
    requiresVerification: false, verifiedLossless: false, fallbackAllowed: false, fallbackOverrideActive: false,
    explanation: 'private database host', spectralResult: 'private result',
  };
  const presentation = buildMissingMusicQualityEvidencePresentation(detail);
  assert.ok(presentation.facts.every(({ value }) => value === 'Not reported'));
  assert.doesNotMatch(JSON.stringify(presentation), /private|\/mnt|proto|upgrade/iu);
  assert.ok(buildMissingMusicQualityEvidencePresentation(null).facts.every(({ value }) => value === 'Not reported'));
});

test('fallback action explains the effective selected bitrate floor without accepting invalid public facts', () => {
  for (const [minimumBitrateKbps, expectedFloor] of [
    [null, 256], [128, 256], [256, 256], [320, 320],
    [-1, 256], [Infinity, 256], [10001, 256], ['320', 256],
  ]) {
    const detail = createDetail();
    detail.qualityEvidence.minimumBitrateKbps = minimumBitrateKbps;
    const presentation = buildMissingMusicQualityEvidencePresentation(detail);
    assert.equal(presentation.actionExplanation,
      `Allow MP3, AAC, Opus, or Ogg at ${expectedFloor} kbps or higher for this release. Audio checks and library checks still apply. Saved automation may continue.`);
    if (minimumBitrateKbps === 320) assert.equal(facts(presentation).Minimum, 'FLAC, ALAC, WAV · lossy audio 320 kbps or higher');
  }
});
