import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryDiscoveryQualityContextService } from '../../src/server/library/library-discovery-quality-context-service.js';
import { evaluateQualityEvidence } from '../../src/server/acquisition/acquisition-quality-policy-service.js';
import { scoreCandidateFormatMatch } from '../../src/server/library/format-preference-scoring.js';

function link(id, consent = false, overrides = {}) {
  return { appUserId: `user-${id}`, wantedReleaseId: id, qualityPreferences: { minimumQuality: 'lossless', preferredFormat: 'flac' },
    ...(consent ? { qualityOverride: { mode: 'allow_fallback_quality', wantedReleaseId: id } } : {}), ...overrides };
}

test('mixed shared consent retains strict search and base verification policy', async () => {
  const service = createLibraryDiscoveryQualityContextService();
  const context = await service.resolveSharedDiscoveryQualityContext({ operatorLinks: [link('first', true), link('second')] });
  assert.equal(context.profileCode, 'lossless_archive');
  assert.equal(context.qualityOverride, null);
  assert.equal(context.preferredFormat, 'flac');
  assert.deepEqual(context.wantedReleaseIds, ['first', 'second']);
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['mp3'], bitrateKbps: 320 }, ...context }).code, 'below_minimum');
});

test('unanimous scoped consent broadens search at 256 kbps while retaining base lossless inspection policy', async () => {
  const service = createLibraryDiscoveryQualityContextService();
  const context = await service.resolveSharedDiscoveryQualityContext({ operatorLinks: [link('first', true), link('second', true)] });
  assert.equal(context.profileCode, 'lossless_archive');
  assert.equal(context.preferredFormat, 'any');
  assert.deepEqual(context.formatPreferences, { minimumQuality: 'high', preferredFormat: 'any', minimumBitrateKbps: 256 });
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['mp3'], bitrateKbps: 256 }, ...context }).autoDownloadEligible, true);
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['mp3'], bitrateKbps: 128 }, ...context }).autoDownloadEligible, false);
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['flac'] }, ...context }).code, 'needs_verification');
  assert.equal(scoreCandidateFormatMatch({ ...context.formatPreferences, extensions: ['mp3'], files: [{ extension: 'mp3', bitRateKbps: 256 }] }).score, 100);
  assert.equal(scoreCandidateFormatMatch({ ...context.formatPreferences, extensions: ['mp3'], files: [{ extension: 'mp3', bitRateKbps: 128 }] }).score, 0);
});

test('unknown requirements, disabled participants and another target consent remain conservative blockers', async () => {
  const service = createLibraryDiscoveryQualityContextService();
  for (const second of [link('second', true, { qualityPreferences: { minimumQuality: 'invalid' } }), link('second', true, { isDisabled: true }),
    link('second', true, { qualityOverride: { mode: 'allow_fallback_quality', wantedReleaseId: 'first' } })]) {
    const context = await service.resolveSharedDiscoveryQualityContext({ operatorLinks: [link('first', true), second] });
    assert.equal(context.preferredFormat, 'flac');
    assert.equal(context.qualityOverride, null);
  }
});

test('shared profile evidence cannot replace a known selected owner requirement', async () => {
  const service = createLibraryDiscoveryQualityContextService();
  const context = await service.resolveSharedDiscoveryQualityContext({ evidence: { qualityProfile: 'lossless_archive' },
    operatorLinks: [link('any', false, { qualityPreferences: { minimumQuality: 'any', preferredFormat: 'any' } })] });
  assert.equal(context.profileCode, 'any_available');
});

test('a saved High minimum remains 320 kbps when another recipient permits 256 kbps fallback', async () => {
  const service = createLibraryDiscoveryQualityContextService();
  const context = await service.resolveSharedDiscoveryQualityContext({ operatorLinks: [link('strict', true),
    link('high', false, { qualityPreferences: { minimumQuality: 'high', preferredFormat: 'any' } })] });
  assert.equal(context.formatPreferences.minimumBitrateKbps, 320);
  assert.equal(context.qualityOverride.minimumBitrateKbps, 320);
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['mp3'], bitrateKbps: 256 }, ...context }).autoDownloadEligible, false);
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['mp3'], bitrateKbps: 320 }, ...context }).autoDownloadEligible, true);
});

test('legacy High and consenting FLAC preference retain the saved 320 kbps minimum', async () => {
  const preferences = { minimumQuality: 'high', preferredFormat: 'flac' };
  const service = createLibraryDiscoveryQualityContextService({ getUserPreferencesFn: async () => preferences });
  const shared = await service.resolveSharedDiscoveryQualityContext({ operatorLinks: [link('high-flac', true, { qualityPreferences: preferences })] });
  assert.equal(shared.profileCode, 'lossless_archive');
  assert.equal(shared.minimumBitrateKbps, 320);
  assert.equal(shared.formatPreferences.minimumBitrateKbps, 320);
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['mp3'], bitrateKbps: 256 }, ...shared }).autoDownloadEligible, false);
  const legacy = await createLibraryDiscoveryQualityContextService({ getUserPreferencesFn: async () => ({ minimumQuality: 'high' }) })
    .resolveSharedDiscoveryQualityContext({ evidence: { sourceRequestedForUserId: 'legacy-user' } });
  assert.equal(legacy.profileCode, 'high_quality');
  assert.equal(legacy.minimumBitrateKbps, 320);
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['mp3'], bitrateKbps: 256 }, ...legacy }).autoDownloadEligible, false);
});
