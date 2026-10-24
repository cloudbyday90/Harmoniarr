/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { applyQualityReviewSearchRequirement, buildQualityReviewSearchRequirement, QUALITY_REVIEW_SEARCH_BLOCKER } from '../../src/server/library/library-quality-review-search-policy.js';
import { createLibraryDiscoveryQualityContextService } from '../../src/server/library/library-discovery-quality-context-service.js';
import { createLibraryDiscoveryDispatchService } from '../../src/server/library/library-discovery-dispatch-service.js';

const wantedId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ownerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const scope = { failedCandidate: { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', sourceSearchId: 'previous-search' },
  participants: [{ appUserId: ownerId, wantedReleaseId: wantedId }],
  wantedReleaseIds: [wantedId], requiredContext: { profileCode: 'lossless_archive', qualityOverride: null } };
const claim = (overrides = {}) => ({ metadataReleaseId: 'release', artistName: 'Artist', releaseTitle: 'Album',
  qualityReviewParticipantsCurrent: true,
  operatorLinks: [{ appUserId: ownerId, wantedReleaseId: wantedId, qualityPreferences: { minimumQuality: 'any', preferredFormat: 'any' } }],
  evidence: { musicQueueRediscovery: { reasonCode: 'quality_review_search_again', qualityReviewRequirement: { ...buildQualityReviewSearchRequirement(scope), ...overrides } } } });

test('the original strict floor overrides looser current preferences and consent without inventing a token', async () => {
  const request = claim(); request.operatorLinks[0].qualityOverride = { mode: 'allow_fallback_quality', wantedReleaseId: wantedId };
  const context = await createLibraryDiscoveryQualityContextService().resolveSharedDiscoveryQualityContext(request);
  assert.equal(context.profileCode, 'lossless_archive'); assert.equal(context.qualityOverride, null);
  assert.equal(context.preferredFormat, 'flac'); assert.equal(context.formatPreferences.minimumQuality, 'lossless');
  assert.equal(buildQualityReviewSearchRequirement(scope).qualityOverride, undefined);
  request.evidence.musicQueueRediscovery.reasonCode = 'quality_choice_search_again';
  assert.equal((await createLibraryDiscoveryQualityContextService().resolveSharedDiscoveryQualityContext(request)).profileCode, 'lossless_archive');
});

test('original bitrate and stricter current requirements reach format policy without copying historical consent', async () => {
  const request = claim({ profileCode: 'high_quality', minimumBitrateKbps: 320, fallbackAllowed: true });
  let context = await createLibraryDiscoveryQualityContextService().resolveSharedDiscoveryQualityContext(request);
  assert.equal(context.profileCode, 'high_quality'); assert.equal(context.minimumBitrateKbps, 320);
  assert.equal(context.formatPreferences.minimumBitrateKbps, 320); assert.equal(context.qualityOverride, null);
  request.operatorLinks[0].qualityPreferences = { minimumQuality: 'lossless', preferredFormat: 'flac' };
  context = await createLibraryDiscoveryQualityContextService().resolveSharedDiscoveryQualityContext(request);
  assert.equal(context.profileCode, 'lossless_archive'); assert.equal(context.qualityOverride, null);
});

test('missing, malformed, foreign and disabled recipient requirements refuse before provider work', async () => {
  for (const request of [claim({ profileCode: 'unknown' }), claim({ minimumBitrateKbps: 128 }), claim({ minimumBitrateKbps: '320' }),
    claim({ wantedReleaseIds: [wantedId, wantedId] }), claim({ wantedReleaseIds: ['cccccccc-cccc-4ccc-8ccc-cccccccccccc'] })]) {
    await assert.rejects(createLibraryDiscoveryQualityContextService().resolveSharedDiscoveryQualityContext(request), error => error.code === QUALITY_REVIEW_SEARCH_BLOCKER);
  }
  const disabled = claim(); disabled.operatorLinks[0].isDisabled = true;
  await assert.rejects(createLibraryDiscoveryQualityContextService().resolveSharedDiscoveryQualityContext(disabled), error => error.code === QUALITY_REVIEW_SEARCH_BLOCKER);
  const missing = claim(); delete missing.evidence.musicQueueRediscovery.qualityReviewRequirement;
  await assert.rejects(createLibraryDiscoveryQualityContextService().resolveSharedDiscoveryQualityContext(missing), error => error.code === QUALITY_REVIEW_SEARCH_BLOCKER);
  const current = { profileCode: 'high_quality', qualityOverride: null };
  assert.equal(applyQualityReviewSearchRequirement(current, {}), current);
});

test('a stale queued requirement is blocked before provider submission or candidate ingestion', async () => {
  let request = claim({ wantedReleaseIds: [] }); let blocked = 0; let providerCalls = 0;
  const service = createLibraryDiscoveryDispatchService({ loadSettingsFn: async () => ({}),
    libraryDiscoveryRequestStore: { claimNextReadyAutomaticDiscoveryRequest: async () => { const current = request; request = null; return current; },
      markDiscoveryRequestQualityReviewBlocked: async () => { blocked++; } },
    slskdService: { startSearch: async () => { providerCalls++; assert.fail('Stale quality scope cannot submit a search'); } },
    importCandidateService: { ingestSlskdSearchResponses: async () => assert.fail('Stale quality scope cannot ingest') },
  });
  const result = await service.dispatchReadyDiscoveryRequests();
  assert.equal(providerCalls, 0); assert.equal(blocked, 1); assert.equal(result.failedCount, 1);
  assert.equal(result.failures[0].code, QUALITY_REVIEW_SEARCH_BLOCKER);
});
