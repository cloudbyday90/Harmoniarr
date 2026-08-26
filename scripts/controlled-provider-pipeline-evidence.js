/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasExpectedCount(value, expected) {
  return Number(value) === expected;
}

function hasAppliedFallback(result) {
  return result?.primaryFinalStatus === 'failed'
    && isNonEmptyString(result?.fallbackApplyRunId);
}

function verifyRecovery(result) {
  return hasAppliedFallback(result);
}

function verifySourceDisappearanceRecovery(result) {
  return hasAppliedFallback(result)
    && result?.terminalOutcome === 'source_disappeared';
}

function verifyQualityRecovery(result) {
  return hasAppliedFallback(result)
    && result?.primaryAudioCodec === 'flac'
    && result?.primaryFilename?.endsWith('.flac')
    && result?.fallbackFinalStatus === 'applied';
}

function verifyQualityExhaustion(result) {
  return result?.primaryFinalStatus === 'failed'
    && result?.primaryAudioCodec === 'flac'
    && result?.primaryFilename?.endsWith('.flac')
    && result?.qualityRecoveryExhaustedCount === 1
    && result?.followUpRunId === null
    && result?.libraryFileCountBefore === result?.libraryFileCountAfter
    && result?.musicQueueStatus === 'needs_help_adding'
    && result?.musicQueueNextAction === 'review_add_plan'
    && result?.activityEntityId === result?.wantedReleaseId
    && result?.activityBlockerCode === 'media_verification';
}

function verifySharedDiscovery(result) {
  return hasExpectedCount(result?.providerSearchCount, 1)
    && hasExpectedCount(result?.providerTransferCount, 1)
    && hasExpectedCount(result?.operatorCount, 2)
    && hasExpectedCount(result?.musicQueueOutcomeCount, 2)
    && result?.crossOperatorReadDenied === true
    && result?.candidatePolicyRedacted === true
    && result?.activityPolicyRedacted === true;
}

function verifySharedRecovery(result) {
  const linkage = result?.downloaderMusicQueueLinkage;
  return hasExpectedCount(result?.providerSearchCount, 1)
    && hasExpectedCount(result?.providerTransferCount, 2)
    && hasExpectedCount(result?.operatorCount, 2)
    && hasExpectedCount(result?.recoveryChainCount, 1)
    && hasExpectedCount(result?.recoveryActivityCount, 2)
    && hasExpectedCount(result?.fallbackActivityCount, 2)
    && hasExpectedCount(result?.musicQueueTryingNextOutcomeCount, 2)
    && hasExpectedCount(result?.musicQueueDownloadingOutcomeCount, 2)
    && result?.primaryFinalStatus === 'failed'
    && result?.fallbackCandidateStatus === 'downloading'
    && isNonEmptyString(result?.fallbackRunId)
    && result?.crossOperatorReadDenied === true
    && result?.candidatePolicyRedacted === true
    && result?.activityPolicyRedacted === true
    && hasExpectedCount(linkage?.operatorCount, 2)
    && hasExpectedCount(linkage?.linkedTransferCount, 2)
    && linkage?.siblingReleaseRedacted === true
    && linkage?.operatorIdentityRedacted === true
    && linkage?.privatePolicyRedacted === true;
}

function verifySharedBoundedStop(result) {
  return hasExpectedCount(result?.providerSearchCount, 1)
    && hasExpectedCount(result?.providerTransferCount, 1)
    && hasExpectedCount(result?.operatorCount, 2)
    && hasExpectedCount(result?.musicQueueNoMatchesOutcomeCount, 2)
    && hasExpectedCount(result?.activityCount, 2)
    && result?.primaryFinalStatus === 'failed'
    && result?.requestStatus === 'blocked'
    && result?.requestBlockedReason === 'download_recovery_exhausted'
    && Array.isArray(result?.repeatDispatchCandidateCounts)
    && result.repeatDispatchCandidateCounts.every((count) => count === 0)
    && result?.crossOperatorReadDenied === true
    && result?.candidatePolicyRedacted === true
    && result?.activityPolicyRedacted === true;
}

function verifySharedManualRestart(result) {
  return hasExpectedCount(result?.providerSearchCount, 1)
    && hasExpectedCount(result?.providerTransferCount, 1)
    && hasExpectedCount(result?.operatorCount, 2)
    && hasExpectedCount(result?.musicQueueReadyToAddOutcomeCount, 2)
    && hasExpectedCount(result?.activityCount, 1)
    && hasExpectedCount(result?.restartAlreadyQueuedCount, 1)
    && isNonEmptyString(result?.restartRunId)
    && result?.requestStatus === 'cooldown'
    && result?.requestBlockedReason === 'automatic_cooldown'
    && result?.researchAttemptCount === 0
    && result?.searchAttemptCount === 0
    && result?.crossOperatorReadDenied === true
    && result?.candidatePolicyRedacted === true
    && result?.activityPolicyRedacted === true;
}

/**
 * Returns only named verification facts. It intentionally does not echo
 * provider, transfer, release, operator, filesystem, or secret values from
 * the verifier payload into command output.
 */
export function getControlledProviderPipelineEvidenceReport(result) {
  const checks = {
    catalog_candidate_count: hasExpectedCount(result?.catalogCandidates, 20),
    catalog_fixture_count: hasExpectedCount(result?.catalogFixtures, 17),
    primary_pipeline: result?.pipeline?.finalStatus === 'applied',
    quality_exhaustion: verifyQualityExhaustion(result?.qualityExhaustion),
    quality_recovery: verifyQualityRecovery(result?.qualityRecovery),
    recovery: verifyRecovery(result?.recovery),
    shared_bounded_stop: verifySharedBoundedStop(result?.sharedBoundedStop),
    shared_discovery: verifySharedDiscovery(result?.sharedDiscovery),
    shared_manual_restart: verifySharedManualRestart(result?.sharedManualRestart),
    shared_recovery: verifySharedRecovery(result?.sharedRecovery),
    source_disappearance_recovery: verifySourceDisappearanceRecovery(result?.sourceDisappearanceRecovery),
  };

  return {
    complete: Object.values(checks).every(Boolean),
    checks,
  };
}

export function assertControlledProviderPipelineEvidence(result) {
  const report = getControlledProviderPipelineEvidenceReport(result);
  if (!report.complete) {
    const failedChecks = Object.entries(report.checks)
      .filter(([, passed]) => !passed)
      .map(([name]) => name);
    throw new Error(`Controlled-provider verifier returned incomplete evidence: ${failedChecks.join(', ')}`);
  }

  return result;
}
