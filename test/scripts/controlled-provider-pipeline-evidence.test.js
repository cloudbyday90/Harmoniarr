/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertControlledProviderPipelineEvidence,
  getControlledProviderPipelineEvidenceReport,
} from '../../scripts/controlled-provider-pipeline-evidence.js';

function createCompleteEvidence() {
  return {
    authorityRefusals: ['missing_owner', 'disabled_owner', 'monitoring_revoked'].map(change => ({ change,
      admittedBeforeChange: true, appliedCount: 0, providerTransferDelta: 0, libraryFilesUnchanged: true })),
    catalogCandidates: 20,
    catalogFixtures: 17,
    pipeline: { finalStatus: 'applied' },
    qualityExhaustion: {
      preflightReviewRecorded: true,
      preflightSkippedReason: 'no_safe_import_pending_candidate',
      activityBlockerCode: 'media_verification',
      activityEntityId: 'wanted-quality-exhaustion',
      followUpRunId: null,
      libraryFileCountAfter: 0,
      libraryFileCountBefore: 0,
      musicQueueNextAction: 'review_add_plan',
      musicQueueStatus: 'needs_help_adding',
      primaryAudioCodec: 'flac',
      primaryFilename: 'quality-exhaustion.flac',
      primaryFinalStatus: 'failed',
      qualityRecoveryExhaustedCount: 1,
      wantedReleaseId: 'wanted-quality-exhaustion',
    },
    qualityRecovery: {
      preflightReviewRecorded: true,
      preflightSkippedReason: 'no_safe_import_pending_candidate',
      fallbackApplyRunId: 'quality-fallback-run',
      fallbackFinalStatus: 'applied',
      primaryAudioCodec: 'flac',
      primaryFilename: 'quality-recovery.flac',
      primaryFinalStatus: 'failed',
    },
    recovery: {
      fallbackApplyRunId: 'recovery-fallback-run',
      primaryFinalStatus: 'failed',
    },
    sharedBoundedStop: {
      activityCount: 2,
      activityPolicyRedacted: true,
      candidatePolicyRedacted: true,
      crossOperatorReadDenied: true,
      musicQueueNoMatchesOutcomeCount: 2,
      operatorCount: 2,
      primaryFinalStatus: 'failed',
      providerSearchCount: 1,
      providerTransferCount: 1,
      repeatDispatchCandidateCounts: [0, 0],
      requestBlockedReason: 'download_recovery_exhausted',
      requestStatus: 'blocked',
    },
    sharedDiscovery: {
      activityPolicyRedacted: true,
      candidatePolicyRedacted: true,
      crossOperatorReadDenied: true,
      musicQueueOutcomeCount: 2,
      operatorCount: 2,
      providerSearchCount: 1,
      providerTransferCount: 1,
    },
    sharedManualRestart: {
      activityCount: 1,
      activityPolicyRedacted: true,
      candidatePolicyRedacted: true,
      crossOperatorReadDenied: true,
      musicQueueReadyToAddOutcomeCount: 2,
      operatorCount: 2,
      providerSearchCount: 1,
      providerTransferCount: 1,
      requestBlockedReason: 'automatic_cooldown',
      requestStatus: 'cooldown',
      researchAttemptCount: 0,
      restartAlreadyQueuedCount: 1,
      restartRunId: 'restart-run',
      searchAttemptCount: 0,
    },
    sharedRecovery: {
      activityPolicyRedacted: true,
      candidatePolicyRedacted: true,
      crossOperatorReadDenied: true,
      downloaderMusicQueueLinkage: {
        linkedTransferCount: 2,
        operatorCount: 2,
        operatorIdentityRedacted: true,
        privatePolicyRedacted: true,
        siblingReleaseRedacted: true,
      },
      fallbackActivityCount: 2,
      fallbackCandidateStatus: 'downloading',
      fallbackRunId: 'shared-recovery-run',
      musicQueueDownloadingOutcomeCount: 2,
      musicQueueTryingNextOutcomeCount: 2,
      operatorCount: 2,
      primaryFinalStatus: 'failed',
      providerSearchCount: 1,
      providerTransferCount: 2,
      recoveryActivityCount: 2,
      recoveryChainCount: 1,
    },
    sourceDisappearanceRecovery: {
      fallbackApplyRunId: 'source-disappearance-run',
      primaryFinalStatus: 'failed',
      terminalOutcome: 'import_blocked',
      addBlockerCode: 'source_path_unavailable',
    },
  };
}

test('controlled-provider pipeline evidence accepts the complete aggregate contract', () => {
  const evidence = createCompleteEvidence();

  assert.deepEqual(getControlledProviderPipelineEvidenceReport(evidence), {
    checks: {
      current_authority: true,
      catalog_candidate_count: true,
      catalog_fixture_count: true,
      primary_pipeline: true,
      quality_exhaustion: true,
      quality_recovery: true,
      recovery: true,
      shared_bounded_stop: true,
      shared_discovery: true,
      shared_manual_restart: true,
      shared_recovery: true,
      source_disappearance_recovery: true,
    },
    complete: true,
  });
  assert.equal(assertControlledProviderPipelineEvidence(evidence), evidence);
});

test('controlled-provider pipeline evidence names missing checks without serializing fixture identities', () => {
  const evidence = createCompleteEvidence();
  evidence.sharedRecovery.fallbackRunId = 'private-run-identity';
  evidence.sharedRecovery.downloaderMusicQueueLinkage = {
    ...evidence.sharedRecovery.downloaderMusicQueueLinkage,
    operatorIdentityRedacted: false,
  };

  assert.throws(
    () => assertControlledProviderPipelineEvidence(evidence),
    (error) => {
      assert.match(error.message, /shared_recovery/u);
      assert.doesNotMatch(error.message, /private-run-identity|wanted-quality-exhaustion/u);
      return true;
    },
  );
});


test('a generic import stop without the specific source blocker cannot qualify source disappearance', () => {
  const evidence = createCompleteEvidence();
  delete evidence.sourceDisappearanceRecovery.addBlockerCode;
  assert.equal(getControlledProviderPipelineEvidenceReport(evidence).checks.source_disappearance_recovery, false);
});

test('current authority qualification requires each distinct refusal and both side-effect checks', () => {
  for (const mutate of [rows => rows.pop(), rows => { rows[2] = rows[0]; }, rows => { rows[0].appliedCount = 1; },
    rows => { rows[0].providerTransferDelta = 1; }, rows => { rows[0].libraryFilesUnchanged = false; }]) {
    const evidence = createCompleteEvidence(); mutate(evidence.authorityRefusals);
    assert.equal(getControlledProviderPipelineEvidenceReport(evidence).checks.current_authority, false);
  }
});

test('worker quality evidence alone does not qualify the earlier preflight refusal', () => {
  const evidence = createCompleteEvidence(); delete evidence.qualityRecovery.preflightSkippedReason;
  delete evidence.qualityExhaustion.preflightSkippedReason;
  const report = getControlledProviderPipelineEvidenceReport(evidence);
  assert.equal(report.checks.quality_recovery, false); assert.equal(report.checks.quality_exhaustion, false);
});
