import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPublicQualityEvidence, canAllowAcquisitionFallbackQuality, evaluateReleaseQualityEvidence,
  isScopedQualityFallbackOverride, resolveAcquisitionQualityProfileCode } from '../../src/server/acquisition/acquisition-quality-evidence-policy.js';
import { createAcquisitionQualityPolicyService } from '../../src/server/acquisition/acquisition-quality-policy-service.js';
import { projectMusicQueueRelease } from '../../src/server/acquisition/acquisition-pipeline-service.js';

const preferences = { minimumQuality: 'lossless', preferredFormat: 'flac' };
function release(overrides = {}) {
  return { id: 'wanted', appUserId: 'target', wantedStatus: 'missing', missingTrackCount: 10,
    qualityPreferences: preferences, discoveryRequest: { searchMode: 'automatic', requestStatus: 'cooldown', blockedReason: 'automatic_cooldown',
      evidence: { qualityProfile: 'high_quality', lastSearchResult: { autoSelection: { quality: {
        code: 'below_minimum', formats: ['mp3'], bitrateKbps: 256, profile: { code: 'any_available' },
        verifiedLossless: true, explanation: '/private/provider-body',
      } } } } }, ...overrides };
}

test('quality projection reconstructs worker observations under target preferences rather than shared profile or verification claims', () => {
  const projected = projectMusicQueueRelease(release());
  assert.equal(projected.quality.code, 'below_minimum');
  assert.equal(projected.quality.profile.code, 'lossless_archive');
  assert.equal(projected.quality.verifiedLossless, false);
  assert.equal(projected.status.code, 'quality_choice_needed');
  assert.equal(canAllowAcquisitionFallbackQuality(projected), true);
  const publicEvidence = buildPublicQualityEvidence(projected.quality);
  assert.deepEqual(publicEvidence.formats, ['mp3']);
  assert.equal(publicEvidence.bitrateKbps, 256);
  assert.doesNotMatch(JSON.stringify(publicEvidence), /private|wanted|target|allowedBy|explanation/);
  const flexible = projectMusicQueueRelease(release({ qualityPreferences: { minimumQuality: 'any', preferredFormat: 'any' } }));
  assert.equal(flexible.quality.profile.code, 'any_available');
  assert.equal(flexible.quality.code, 'accepted');
  assert.equal(canAllowAcquisitionFallbackQuality(flexible), false);
});

test('quality fallback uses only the selected wanted link and keeps 128 kbps below its bounded floor', () => {
  const scoped = release({ discoveryQualityOverride: { mode: 'allow_fallback_quality', wantedReleaseId: 'wanted' } });
  assert.equal(projectMusicQueueRelease(scoped).quality.code, 'accepted');
  scoped.discoveryRequest.evidence.lastSearchResult.autoSelection.quality.bitrateKbps = 128;
  assert.equal(projectMusicQueueRelease(scoped).quality.code, 'below_minimum');
  scoped.discoveryQualityOverride.wantedReleaseId = 'sibling';
  assert.equal(projectMusicQueueRelease(scoped).quality.fallbackOverrideActive, false);
  scoped.discoveryRequest.evidence.musicQueueQualityOverride = { mode: 'allow_fallback_quality', wantedReleaseId: 'wanted' };
  assert.equal(projectMusicQueueRelease(scoped).quality.fallbackOverrideActive, false);
  assert.equal(isScopedQualityFallbackOverride({ mode: 'arbitrary', wantedReleaseId: 'wanted' }, 'wanted'), false);
});

test('quality policy preserves strict unknown requirements and refuses ineffective or verification fallback choices', () => {
  assert.equal(resolveAcquisitionQualityProfileCode({ userPreferences: {} }), 'any_available');
  assert.equal(resolveAcquisitionQualityProfileCode({ userPreferences: null }), 'lossless_archive');
  assert.equal(resolveAcquisitionQualityProfileCode({ userPreferences: { minimumQuality: 'invalid' } }), 'lossless_archive');
  assert.equal(resolveAcquisitionQualityProfileCode({ explicitProfile: 'unknown', userPreferences: { minimumQuality: 'any', preferredFormat: 'any' } }), 'lossless_archive');
  assert.equal(resolveAcquisitionQualityProfileCode({ userPreferences: { minimumQuality: 'lossless', preferredFormat: 'mp3_320' } }), 'lossless_archive');
  for (const [code, profile] of [['needs_verification', 'lossless_archive'], ['below_minimum', 'high_quality'], ['below_minimum', 'any_available']]) {
    assert.equal(canAllowAcquisitionFallbackQuality({ status: { code: 'quality_choice_needed' }, quality: { code, profile: { code: profile } } }), false);
  }
});

test('queued rediscovery suppresses stale quality stops and match choices until a new worker observation arrives', () => {
  const current = release();
  current.discoveryRequest.requestStatus = 'ready';
  current.discoveryRequest.blockedReason = null;
  current.discoveryRequest.evidence.musicQueueRediscovery = { requestedAt: '2026-10-03T12:00:00.000Z' };
  current.discoveryRequest.importReviewSummary = { totalCount: 1, statusCounts: { pending: 1 } };
  const pending = projectMusicQueueRelease(current);
  assert.equal(pending.status.code, 'queued_for_search');
  assert.equal(pending.quality.code, 'no_evidence');
  current.discoveryRequest.requestStatus = 'cooldown';
  current.discoveryRequest.evidence.lastSearchResult.observedAt = '2026-10-03T12:01:00.000Z';
  assert.equal(projectMusicQueueRelease(current).status.code, 'quality_choice_needed');
});

test('public quality evidence omits unknown formats, raw text and unbounded numeric values', () => {
  assert.deepEqual(buildPublicQualityEvidence({ code: 'private', formats: ['FLAC', 'flac', '/secret/path'], bitrateKbps: Infinity,
    profile: { code: 'private', minimumBitrateKbps: -1, minimumFormats: ['mp3', 'private'], preferredFormats: null } }), {
    code: null, profileCode: null, formats: ['flac'], bitrateKbps: null, preferredFormats: [], minimumFormats: ['mp3'],
    minimumBitrateKbps: null, requiresVerification: false, verifiedLossless: false, fallbackAllowed: false, fallbackOverrideActive: false,
  });
  assert.equal(evaluateReleaseQualityEvidence(release(), createAcquisitionQualityPolicyService()).code, 'below_minimum');
});

test('fallback permission accepts only fresh automatic stopped searches and retains a High floor beneath FLAC preference', () => {
  for (const [searchMode, requestStatus] of [['automatic', 'ready'], ['automatic', 'completed'], ['manual', 'cooldown']]) {
    const current = release();
    Object.assign(current.discoveryRequest, { searchMode, requestStatus });
    assert.equal(canAllowAcquisitionFallbackQuality(projectMusicQueueRelease(current)), false);
  }
  const current = release({ qualityPreferences: { minimumQuality: 'high', preferredFormat: 'flac' },
    discoveryQualityOverride: { mode: 'allow_fallback_quality', wantedReleaseId: 'wanted' } });
  const projected = projectMusicQueueRelease(current);
  assert.equal(projected.quality.profile.code, 'lossless_archive');
  assert.equal(projected.quality.profile.minimumBitrateKbps, 320);
  assert.equal(projected.quality.code, 'below_minimum');
});
