import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateQualityEvidence } from '../../src/server/acquisition/acquisition-quality-policy-service.js';
import { buildStageCandidateBase } from '../../src/server/import-candidates/import-candidate-stage-summary.js';
import { createImportCandidateSafeAutoAddQualityGateService } from '../../src/server/import-candidates/import-candidate-safe-auto-add-quality-gate.js';
import {
  buildRecoveryQualityContext,
  canRetireRecoverySelection,
  captureRecoveryObservation,
  hasCurrentRecoveryDiscovery,
  hasCurrentRecoveryRecipients,
  hasOwnedRecoveryOrigin,
  hasSameRecoveryIdentity,
  isValidRecoveryBaseline,
  matchesAcceptedRecoveryProvenance,
  matchesRecoveryObservation,
  MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE,
} from '../../src/server/import-candidates/music-queue-recovery-policy.js';

const primaryId = '00000000-0000-4000-8000-000000000001';
const siblingId = '00000000-0000-4000-8000-000000000002';
const metadataReleaseId = '00000000-0000-4000-8000-000000000003';
const timestamp = '2026-10-08T20:00:00.000Z';
const consent = (id, minimumBitrateKbps = 256) => ({ mode: 'allow_fallback_quality', wantedReleaseId: id, minimumBitrateKbps });

function candidate() {
  return {
    id: 'candidate-1', status: 'selected', updatedAt: timestamp,
    sourceSearchId: 'search-current', sourceProvider: 'slskd', sourceResponseKey: 'response-1',
    username: 'source-user', folderPath: 'Artist/Release',
    files: [{ id: 'file-1', filename: 'Artist/Release/01.mp3', sizeBytes: 1000, extension: 'mp3', bitRateKbps: 320, isLocked: false }],
    normalizedPayload: {
      musicQueue: { wantedReleaseId: primaryId, wantedReleaseIds: [primaryId, siblingId],
        sharedOperatorDiscovery: true, profileCode: 'lossless_archive', qualityOverride: consent(primaryId) },
      discoveryScope: { metadataReleaseId },
      requestOwnership: { metadataReleaseId, sourceRequestedForUserId: 'primary-user', sourceType: 'music_queue' },
    },
  };
}
function participants() {
  return [primaryId, siblingId].map((wantedReleaseId, index) => ({
    wantedReleaseId, appUserId: index === 0 ? 'primary-user' : 'sibling-user', metadataReleaseId,
    qualityPreferences: { minimumQuality: 'lossless', preferredFormat: 'flac' }, qualityOverride: consent(wantedReleaseId),
    discoveryLinkExists: true, isDisabled: false, wantedStatus: 'missing', missingTrackCount: 1, visibilityState: 'visible',
  }));
}
function discovery() {
  return { searchMode: 'automatic', lastSearchAt: timestamp,
    evidence: { lastSearchId: 'search-current', lastDispatchAttemptedAt: timestamp,
      lastSearchResult: { observedAt: '2026-10-08T20:01:00.000Z' } } };
}

test('terminal observation rejects provenance drift while accepted transfer identity permits legitimate phase changes', () => {
  const acquired = candidate();
  const observed = captureRecoveryObservation(acquired);
  assert.equal(matchesRecoveryObservation({ ...acquired, updatedAt: new Date(timestamp) }, observed), true);
  const downloading = { ...acquired, status: 'downloading', updatedAt: '2026-10-08T20:02:00.000Z' };
  assert.equal(matchesRecoveryObservation(downloading, observed), false);
  assert.equal(matchesAcceptedRecoveryProvenance(downloading, observed), true);
  for (const changed of [
    { ...acquired, sourceSearchId: 'new-search' },
    { ...acquired, username: 'different-source' },
    { ...acquired, sourceResponseKey: 'different-response' },
    { ...acquired, files: [{ ...acquired.files[0], sizeBytes: 2000 }] },
    { ...acquired, files: [{ ...acquired.files[0], isLocked: true }] },
  ]) {
    assert.equal(matchesRecoveryObservation(changed, observed), false);
    assert.equal(matchesAcceptedRecoveryProvenance(changed, observed), false);
  }
});

test('changed physical recipient and acquired membership cannot reuse an accepted recovery observation', () => {
  const acquired = candidate();
  const observed = captureRecoveryObservation(acquired);
  const changed = candidate();
  changed.normalizedPayload.requestOwnership.sourceRequestedForUserId = 'sibling-user';
  assert.equal(matchesAcceptedRecoveryProvenance(changed, observed), false);
  const lateParticipant = candidate();
  lateParticipant.normalizedPayload.musicQueue.wantedReleaseIds.push(metadataReleaseId);
  assert.equal(matchesAcceptedRecoveryProvenance(lateParticipant, observed), false);
});

test('older search replacement may retain exact scope without accepting another primary, recipient or external intent', () => {
  const failed = candidate();
  const replacement = candidate();
  replacement.id = 'candidate-2';
  replacement.sourceSearchId = 'older-search';
  assert.equal(hasSameRecoveryIdentity(failed, replacement), true);
  const retargeted = candidate();
  retargeted.normalizedPayload.requestOwnership.sourceRequestedForUserId = 'sibling-user';
  assert.equal(hasSameRecoveryIdentity(failed, retargeted), false);
  const otherPrimary = candidate();
  otherPrimary.normalizedPayload.musicQueue.wantedReleaseId = siblingId;
  assert.equal(hasSameRecoveryIdentity(failed, otherPrimary), false);
  const external = candidate();
  external.normalizedPayload.requestOwnership.externalRequestReleaseIntentId = 'external-intent';
  assert.equal(hasSameRecoveryIdentity(external, external), false);
  assert.equal(hasSameRecoveryIdentity(failed, { ...replacement, normalizedPayload: {} }), false);
});

test('fresh recipient authority requires the whole acquired set and current eligible physical ownership', () => {
  const acquired = candidate();
  const current = participants();
  assert.equal(hasCurrentRecoveryRecipients(acquired, current), true);
  assert.equal(hasCurrentRecoveryRecipients(acquired, [current[0]]), false);
  assert.equal(hasCurrentRecoveryRecipients(acquired, [...current, { ...current[1], wantedReleaseId: metadataReleaseId }]), false);
  for (const drift of [{ isDisabled: true }, { discoveryLinkExists: false }, { wantedStatus: 'complete' },
    { missingTrackCount: 0 }, { visibilityState: 'ignored' }, { metadataReleaseId: 'other-release' }]) {
    assert.equal(hasCurrentRecoveryRecipients(acquired, [current[0], { ...current[1], ...drift }]), false);
  }
});

test('an ordinary in-flight discovery claim invalidates recovery before a new result changes lastSearchId', () => {
  const current = discovery();
  assert.equal(hasCurrentRecoveryDiscovery(current, 'search-current'), true);
  assert.equal(hasCurrentRecoveryDiscovery({ ...current, evidence: { ...current.evidence,
    lastDispatchAttemptedAt: '2026-10-08T20:02:00.000Z' } }, 'search-current'), false);
  assert.equal(hasCurrentRecoveryDiscovery(current, 'old-search'), false);
  assert.equal(hasCurrentRecoveryDiscovery({ ...current, searchMode: 'manual' }, 'search-current'), false);
  assert.equal(hasCurrentRecoveryDiscovery({ ...current, evidence: { lastSearchId: 'search-current' } }, 'search-current'), false);
});

test('raw malformed ownership and durable recovery or canonical source survive mutable context removal', () => {
  assert.equal(hasOwnedRecoveryOrigin({ normalizedPayload: { musicQueue: null } }, null), true);
  assert.equal(hasOwnedRecoveryOrigin({ normalizedPayload: {} }, { summary: { triggerSource: MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE } }), true);
  assert.equal(hasOwnedRecoveryOrigin({ normalizedPayload: {} }, { summary: { triggerSource: 'missing_music_manual', sourceWantedReleaseId: primaryId } }), true);
  assert.equal(hasOwnedRecoveryOrigin({ normalizedPayload: {} }, { summary: { triggerSource: 'manual' } }), false);
});

test('known-undispatched retirement refuses a newer source or changed physical identity', () => {
  const acquired = candidate();
  const accepted = captureRecoveryObservation(acquired);
  assert.equal(canRetireRecoverySelection({ ...acquired, updatedAt: '2026-10-08T20:03:00.000Z' }, accepted), true);
  assert.equal(canRetireRecoverySelection({ ...acquired, status: 'downloading' }, accepted), false);
  assert.equal(canRetireRecoverySelection({ ...acquired, sourceSearchId: 'newer-search' }, accepted), false);
  const retargeted = candidate();
  retargeted.normalizedPayload.requestOwnership.sourceRequestedForUserId = 'sibling-user';
  assert.equal(canRetireRecoverySelection(retargeted, accepted), false);
});

test('all consenting Lossless recipients retain a sibling 320 floor through recovery selection and search scoring', async () => {
  const current = participants();
  current[1].qualityOverride = consent(siblingId, 320);
  const context = await buildRecoveryQualityContext({ failedCandidate: candidate(), participants: current });
  assert.equal(context.profileCode, 'lossless_archive');
  assert.equal(context.minimumBitrateKbps, 320);
  assert.equal(context.qualityOverride.minimumBitrateKbps, 320);
  assert.deepEqual(context.formatPreferences, { minimumQuality: 'high', preferredFormat: 'any', minimumBitrateKbps: 320 });
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['mp3'], bitrateKbps: 256 }, ...context }).autoDownloadEligible, false);
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['mp3'], bitrateKbps: 320 }, ...context }).autoDownloadEligible, true);
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['flac'] }, ...context }).code, 'needs_verification');
});

test('revoked shared consent is explicit null while historical numeric minimum remains a lower bound', async () => {
  const failed = candidate();
  failed.normalizedPayload.musicQueue.minimumBitrateKbps = 320;
  const current = participants();
  current[1].qualityOverride = null;
  const context = await buildRecoveryQualityContext({ failedCandidate: failed, participants: current });
  assert.equal(context.qualityOverride, null);
  assert.equal(context.minimumBitrateKbps, 320);
  assert.equal(context.preferredFormat, 'flac');
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['mp3'], bitrateKbps: 320 }, ...context }).autoDownloadEligible, false);
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['flac'] }, ...context }).code, 'needs_verification');
});

test('chosen candidate and durable baseline minima cannot be relaxed by current broader consent', async () => {
  const failed = candidate();
  const replacement = candidate();
  replacement.normalizedPayload.musicQueue.minimumBitrateKbps = 320;
  const fromReplacement = await buildRecoveryQualityContext({ failedCandidate: failed, candidate: replacement, participants: participants() });
  assert.equal(fromReplacement.minimumBitrateKbps, 320);
  const fromRun = await buildRecoveryQualityContext({ failedCandidate: failed, participants: participants(),
    baselineRequirement: { profileCode: 'lossless_archive', minimumBitrateKbps: 320 } });
  assert.equal(fromRun.minimumBitrateKbps, 320);
  assert.equal(evaluateQualityEvidence({ candidate: { formats: ['mp3'], bitrateKbps: 256 }, ...fromRun }).autoDownloadEligible, false);
});

test('a recovered sibling floor survives staging and rejects measured below-floor media before automatic library add', async () => {
  const current = participants();
  current[1].qualityOverride = consent(siblingId, 320);
  const recovered = candidate();
  recovered.normalizedPayload.musicQueue = await buildRecoveryQualityContext({ failedCandidate: recovered, participants: current });
  const staged = buildStageCandidateBase(recovered);
  assert.equal(staged.musicQueueContext.minimumBitrateKbps, 320);
  const gate = createImportCandidateSafeAutoAddQualityGateService();
  const measured = await gate.evaluateSafeAutoAddQuality({ summaryCandidate: staged, applyPreview: { files: [{
    filename: '01.mp3', status: { code: 'ready' }, inspection: { metadata: {
      primaryAudioCodec: 'mp3', containerFormatName: 'mp3', bitRate: 256000,
    }, warnings: [] },
  }] } });
  assert.equal(measured.eligible, false);
  assert.equal(measured.checkedFileCount, 1);
});

test('durable delayed baselines require an explicit known profile and typed nullable or bounded numeric floor', () => {
  assert.equal(isValidRecoveryBaseline({ profileCode: 'lossless_archive', minimumBitrateKbps: 320 }), true);
  assert.equal(isValidRecoveryBaseline({ profileCode: 'any_available', minimumBitrateKbps: null }), true);
  for (const invalid of [null, [], {}, { profileCode: 'lossless_archive' }, { profileCode: 'unknown', minimumBitrateKbps: 320 },
    { profileCode: 'high_quality', minimumBitrateKbps: '320' }, { profileCode: 'high_quality', minimumBitrateKbps: 128 },
    { profileCode: 'high_quality', minimumBitrateKbps: 10001 }, { profileCode: 'high_quality', minimumBitrateKbps: Number.NaN }]) {
    assert.equal(isValidRecoveryBaseline(invalid), false);
  }
});
