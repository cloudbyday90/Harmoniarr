import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveWantedRecoveryDiscovery, deriveWantedRecoveryProgress } from '../../src/server/library/library-wanted-recovery-progress-policy.js';
import { buildAutomaticLibraryAddAuthority } from '../../src/server/import-candidates/import-candidate-music-queue-auto-safe-add-policy.js';
import { captureRecoveryObservation } from '../../src/server/import-candidates/music-queue-recovery-policy.js';
import { createDownloadAttempt, evaluateDownloadReceipt } from '../../src/server/slskd/slskd-download-attempt-policy.js';

const wantedId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const metadataId = '00000000-0000-4000-8000-000000000003';
function fixture() {
  const candidate = { id: 'private-candidate', status: 'selected', selectionReason: 'recovery_cascade', sourceSearchId: 'older-search',
    sourceProvider: 'slskd', username: 'private-provider', folderPath: '/private/download',
    normalizedPayload: { extensions: ['mp3'], bitrateKbps: 320, musicQueue: { profileCode: 'high_quality', minimumBitrateKbps: 320, wantedReleaseId: wantedId },
      requestOwnership: { metadataReleaseId: metadataId, sourceRequestedForUserId: userId } },
    files: [{ id: 'private-file', filename: 'Track.mp3', extension: 'mp3', sizeBytes: 1000, bitRateKbps: 320, isLocked: false }] };
  const record = { metadataReleaseId: metadataId, failedSourceSearchId: 'current-search', authority: buildAutomaticLibraryAddAuthority(candidate),
    selectedObservation: captureRecoveryObservation(candidate), baselineRequirement: { profileCode: 'high_quality', minimumBitrateKbps: 320 } };
  const entry = { candidate, recoveryRun: { id: 'private-run', status: 'pending', summary: { triggerSource: 'music_queue_fallback_recovery',
    selectedCandidateId: candidate.id, sourceWantedReleaseId: wantedId, sourceSearchId: candidate.sourceSearchId, musicQueueRecovery: record } },
  latestExecutionOriginId: 'private-run', hasConflictingSelection: false, confirmedTransferCount: 0, ordinaryRuns: [],
  participants: [{ wantedReleaseId: wantedId, appUserId: userId, metadataReleaseId: metadataId, wantedStatus: 'missing', missingTrackCount: 1,
    discoveryLinkExists: true, isDisabled: false, qualityPreferences: { minimumQuality: 'high', preferredFormat: 'any' } }],
  discovery: { searchMode: 'automatic', lastSearchAt: '2026-10-08T00:00:00Z', evidence: { lastSearchId: 'current-search',
    lastSearchResult: { observedAt: '2026-10-08T00:01:00Z' } } } };
  return { entry, read: () => deriveWantedRecoveryProgress({ entries: [entry], wantedReleaseId: wantedId, metadataReleaseId: metadataId }) };
}

test('read facts distinguish current preparation, completed child and exact confirmed older-search transfers', async () => {
  const { entry, read } = fixture();
  assert.deepEqual((await read()).recoveryExecution, { status: 'pending', candidateMatches: true, authorityReserved: true, reservationRetained: true });
  entry.recoveryRun.status = 'running';
  assert.equal((await read()).recoveryExecution.status, 'running');
  entry.recoveryRun.status = 'completed';
  const completed = await read();
  assert.equal(completed.currentConfirmedTransferCount, 0, 'completed preparation alone is not a provider transfer');
  assert.equal(completed.recoveryExecution.status, null);
  assert.equal(completed.recoveryExecution.reservationRetained, true);
  entry.confirmedTransferCount = 2;
  assert.equal((await read()).currentConfirmedTransferCount, 2);
  entry.candidate.status = 'downloading';
  assert.equal((await read()).currentConfirmedTransferCount, 2, 'physical receipt persists after the child completes');
});

test('live scope, policy and provenance loss refuse read progress without publishing the private cause', async () => {
  for (const change of ['disabled', 'unlinked', 'late_member', 'changed_epoch', 'conflict', 'lost_context', 'changed_file', 'lower_bitrate', 'wrong_source', 'wrong_target', 'missing_baseline', 'invalid_baseline', 'newer_origin']) {
    const { entry, read } = fixture();
    if (change === 'disabled') entry.participants[0].isDisabled = true;
    if (change === 'unlinked') entry.participants[0].discoveryLinkExists = false;
    if (change === 'late_member') entry.participants.push({ ...entry.participants[0], wantedReleaseId: '00000000-0000-4000-8000-000000000004' });
    if (change === 'changed_epoch') entry.discovery.evidence.lastSearchId = 'newer-search';
    if (change === 'conflict') entry.hasConflictingSelection = true;
    if (change === 'lost_context') delete entry.candidate.normalizedPayload.musicQueue;
    if (change === 'changed_file') entry.candidate.files[0].sizeBytes = 2;
    if (change === 'lower_bitrate') entry.candidate.normalizedPayload.bitrateKbps = 256;
    if (change === 'wrong_source') entry.recoveryRun.summary.sourceSearchId = 'unrelated-search';
    if (change === 'wrong_target') entry.recoveryRun.summary.musicQueueRecovery.authority.wantedReleaseIds = [userId];
    if (change === 'missing_baseline') delete entry.recoveryRun.summary.musicQueueRecovery.baselineRequirement;
    if (change === 'invalid_baseline') entry.recoveryRun.summary.musicQueueRecovery.baselineRequirement.minimumBitrateKbps = '320';
    if (change === 'newer_origin') entry.latestExecutionOriginId = 'newer-ordinary-run';
    const facts = await read();
    assert.equal(facts.recoveryExecution.authorityReserved, false, change);
    assert.equal(facts.currentConfirmedTransferCount, 0);
    assert.doesNotMatch(JSON.stringify(facts), /private-|participant|qualityOverride|baselineRequirement|username|folderPath|older-search/u);
  }
});

test('accepted receipts remain observations after policy changes while cancellation cannot authorize preparation', async () => {
  const { entry, read } = fixture();
  entry.confirmedTransferCount = 1;
  entry.participants[0].isDisabled = true;
  assert.equal((await read()).currentConfirmedTransferCount, 1);
  assert.equal((await read()).recoveryExecution.authorityReserved, false);
  entry.recoveryRun.cancelRequested = true;
  assert.equal((await read()).recoveryExecution.reservationRetained, true);
});

test('known retirement, new explicit selection and ordinary stopped items do not inherit the old private reservation', async () => {
  const { entry, read } = fixture();
  entry.recoveryRun.summary.musicQueueRecovery.retired = true;
  assert.equal((await read()).recoveryExecution.reservationRetained, false);
  assert.equal((await read()).recoverySelectionNeedsReview, true);
  entry.independentlySelected = true;
  entry.candidate.selectionReason = 'manual';
  entry.ordinaryRuns = [{ status: 'pending', itemStatus: null }, { status: 'running', itemStatus: 'blocked' }];
  const ordinary = await read();
  assert.deepEqual(ordinary.currentExecutionStatusCounts, { pending: 1 });
  assert.equal(ordinary.recoveryExecution.reservationRetained, false);
  assert.equal(ordinary.recoverySelectionNeedsReview, false);
});

test('owned delayed search facts distinguish waiting, claimed and retained uncertain handoffs without private identity', () => {
  const { entry } = fixture();
  const record = { ...entry.recoveryRun.summary.musicQueueRecovery, failedCandidateId: entry.candidate.id,
    nextSearchAfter: '2030-10-08T00:00:00.000Z' };
  entry.candidate.status = 'failed';
  entry.recoveryRun.summary = { triggerSource: 'music_queue_fallback_rediscovery', musicQueueRecovery: record };
  entry.latestReservationId = entry.recoveryRun.id;
  entry.discovery.requestStatus = 'ready';
  entry.discovery.nextSearchAfter = record.nextSearchAfter;
  entry.discovery.evidence.downloadRecoveryRediscovery = { owningRunId: entry.recoveryRun.id, sourceSearchId: record.failedSourceSearchId };
  const read = () => deriveWantedRecoveryDiscovery({ entry, wantedReleaseId: wantedId, metadataReleaseId: metadataId });
  assert.deepEqual(read(), { status: 'pending', reservationRetained: true });
  entry.recoveryRun.status = 'running';
  assert.equal(read().status, 'pending', 'a running worker waiting for its deadline is not an active search');
  entry.discovery.requestStatus = 'cooldown';
  entry.discovery.evidence.lastDispatchRunId = entry.recoveryRun.id;
  entry.discovery.evidence.lastDispatchAttemptedAt = '2026-10-08T00:03:00.000Z';
  assert.equal(read().status, 'running');
  entry.recoveryRun.status = 'completed';
  assert.deepEqual(read(), { status: null, reservationRetained: true });
  assert.doesNotMatch(JSON.stringify(read()), /private-|authority|participant|sourceSearchId|wantedReleaseId/u);
  for (const state of ['completed', 'guard_refused']) {
    entry.discovery.evidence.downloadRecoveryRediscovery.state = state;
    assert.equal(read(), null);
  }
  delete entry.discovery.evidence.downloadRecoveryRediscovery.state;
  entry.discovery.evidence.lastSearchId = 'newer-search';
  assert.equal(read(), null);
});

test('current search scope and typed baseline loss preserve review without promising a queued search', () => {
  for (const change of ['disabled', 'unlinked', 'missing_baseline', 'different_owner', 'conflict', 'cancelled']) {
    const { entry } = fixture();
    entry.candidate.status = 'failed';
    const record = entry.recoveryRun.summary.musicQueueRecovery;
    record.failedCandidateId = entry.candidate.id; record.nextSearchAfter = '2030-10-08T00:00:00.000Z';
    entry.recoveryRun.summary.triggerSource = 'music_queue_fallback_rediscovery';
    entry.latestReservationId = entry.recoveryRun.id;
    entry.discovery.requestStatus = 'ready'; entry.discovery.nextSearchAfter = record.nextSearchAfter;
    entry.discovery.evidence.downloadRecoveryRediscovery = { owningRunId: entry.recoveryRun.id, sourceSearchId: record.failedSourceSearchId };
    if (change === 'disabled') entry.participants[0].isDisabled = true;
    if (change === 'unlinked') entry.participants[0].discoveryLinkExists = false;
    if (change === 'missing_baseline') delete record.baselineRequirement;
    if (change === 'different_owner') entry.latestReservationId = 'newer-run';
    if (change === 'conflict') entry.hasConflictingSelection = true;
    if (change === 'cancelled') entry.recoveryRun.cancelRequested = true;
    assert.deepEqual(deriveWantedRecoveryDiscovery({ entry, wantedReleaseId: wantedId, metadataReleaseId: metadataId }),
      { status: null, reservationRetained: true }, change);
  }
});

test('malformed discovery recipient facts cannot throw or promise progress', () => {
  for (const ids of [1, {}, 'private-invalid-scope', null]) {
    const { entry } = fixture();
    const record = entry.recoveryRun.summary.musicQueueRecovery;
    record.authority.wantedReleaseIds = ids;
    entry.recoveryRun.summary.triggerSource = 'music_queue_fallback_rediscovery';
    entry.discovery.evidence.downloadRecoveryRediscovery = { owningRunId: entry.recoveryRun.id, sourceSearchId: record.failedSourceSearchId };
    assert.equal(deriveWantedRecoveryDiscovery({ entry, wantedReleaseId: wantedId, metadataReleaseId: metadataId }), null);
  }
});

test('current unresolved handoff survives terminal jobs and revoked context without mistaking old attempts for current progress', async () => {
  const { entry, read } = fixture();
  const requestedFiles = [{ filename: 'One.mp3', size: 1000 }, { filename: 'Two.mp3', size: 1000 }];
  const attempt = evaluateDownloadReceipt({ attempt: createDownloadAttempt({ importCandidateId: entry.candidate.id,
    operationRunId: entry.recoveryRun.id, requestedFiles, username: entry.candidate.username,
    sourceObservation: captureRecoveryObservation(entry.candidate) }), enqueueResult: {
    enqueued: [{ id: '10000000-0000-4000-8000-000000000001', username: entry.candidate.username, ...requestedFiles[0] }], failed: [] } }).attempt;
  entry.currentHandoff = { runId: entry.recoveryRun.id, candidateId: entry.candidate.id, itemStatus: 'awaiting_confirmation',
    requestedFiles, summary: { sourceWantedReleaseId: wantedId }, handoff: { state: 'awaiting_confirmation', attempt } };
  entry.recoveryRun.status = 'completed';
  assert.deepEqual((await read()).currentDownloadHandoff, { confirmationPending: true, disposition: 'partial' });
  delete entry.candidate.normalizedPayload.musicQueue;
  assert.equal((await read()).currentDownloadHandoff.confirmationPending, true, 'unknown acceptance remains blocking when current eligibility changes');
  entry.latestExecutionOriginId = 'newer';
  assert.equal((await read()).currentDownloadHandoff.confirmationPending, true, 'mere job allocation does not resolve a dispatched attempt');
  entry.currentHandoff.runId = 'newer';
  entry.currentHandoff.handoff.state = 'not_dispatched';
  assert.equal((await read()).currentDownloadHandoff, null, 'known no POST is not unresolved acceptance');
  entry.currentHandoff.itemStatus = 'queued'; entry.currentHandoff.handoff = { state: 'confirmed' };
  assert.equal((await read()).currentDownloadHandoff, null);
});
