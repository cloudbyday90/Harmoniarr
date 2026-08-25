/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Wanted-release normalization helpers.
 *
 * Provides utilities for mapping the local `library_wanted_releases` API shape
 * (from `GET /api/v1/library/wanted-releases`) into shapes that are compatible
 * with `ReleaseCard` and `RequestButton`. Kept as pure functions for easy
 * unit testing without Vue dependencies.
 */

/**
 * Maps a wanted release item (from `fetchLibraryWantedReleases`) to a shape
 * that `ReleaseCard` understands.
 *
 * Key transformations:
 * - `id` is set to `null` — the wanted release `id` is a local DB UUID, not a
 *   MusicBrainz release MBID. Passing it to `ArtworkImage` would produce
 *   incorrect artwork URLs. Instead, `musicbrainzReleaseId` is carried through
 *   so `ReleaseCard`'s `releaseMbid` computed falls back to that field.
 * - `releaseGroupId` is derived from `musicbrainzReleaseGroupId` so the
 *   `releaseGroupMbid` computed in `ReleaseCard` resolves correctly for the
 *   CAA release-group fallback.
 * - `title` and `artistCredit` are mapped from the local field names so the
 *   release-normalization helpers (`getReleaseTitle`, `getReleaseArtistName`)
 *   work without modification.
 * - Track counts and `wantedStatus` are forwarded for display in the actions slot.
 *
 * @param {object} release - Wanted release object from the API.
 * @returns {object} ReleaseCard-compatible release object.
 */
export function normalizeWantedReleaseForCard(release) {
  if (!release) return {};
  return {
    // Explicitly null out the local DB UUID so it is never used as an artwork MBID.
    id: null,
    musicbrainzReleaseId: release.musicbrainzReleaseId ?? null,
    releaseGroupId: release.musicbrainzReleaseGroupId ?? null,

    // Title/artist fields: ReleaseCard helpers read `title` and `artistCredit`.
    title: release.releaseTitle ?? null,
    artistCredit: release.artistName ?? null,
    disambiguation: release.releaseDisambiguation ?? null,

    // Date: getReleaseYear reads `date` or `releaseDate` — map to `date` for
    // canonical form and keep `releaseDate` as a passthrough fallback.
    date: release.releaseDate ?? null,

    // Release-group primary type is surfaced in the meta line by ReleaseCard.
    releaseGroup: {
      primaryType: release.releaseGroupType ?? null,
    },

    // Wanted-specific fields forwarded for the custom actions slot.
    wantedStatus: release.wantedStatus ?? null,
    expectedTrackCount: release.expectedTrackCount ?? 0,
    matchedTrackCount: release.matchedTrackCount ?? 0,
    missingTrackCount: release.missingTrackCount ?? 0,
    discoveryRequest: release.discoveryRequest ?? null,
    metadataReleaseId: release.metadataReleaseId ?? null,
    metadataReleaseGroupId: release.metadataReleaseGroupId ?? null,
    selectionSource: release.evidence?.selectionSource ?? null,
    selectionState: release.evidence?.selectionState ?? null,

    // Forwarded for potential artist-detail navigation.
    metadataArtistId: release.metadataArtistId ?? null,
  };
}

function formatAttemptCount(value, maxValue = null) {
  const count = Number.parseInt(String(value ?? 0), 10) || 0;
  const max = Number.parseInt(String(maxValue ?? 0), 10) || 0;
  return max > 0 ? `${count}/${max}` : String(count);
}

function formatShortIdentifier(value) {
  if (!value || typeof value !== 'string') return null;
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function formatEvidenceTimestamp(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * Builds the operator-facing download-recovery notice for a wanted release.
 *
 * @param {object} release - Raw or normalized wanted release object.
 * @returns {{title: string, message: string, details: Array<{label: string, value: string}>}|null}
 */
export function buildDownloadRecoveryNotice(release) {
  const discoveryRequest = release?.discoveryRequest;
  if (discoveryRequest?.blockedReason !== 'download_recovery_exhausted') {
    return null;
  }

  const exhaustedEvidence = discoveryRequest.evidence?.downloadRecoveryExhausted ?? {};
  const details = [
    {
      label: 'Research attempts',
      value: formatAttemptCount(
        discoveryRequest.researchAttemptCount,
        exhaustedEvidence.maxResearchAttemptCount,
      ),
    },
    {
      label: 'Search attempts',
      value: formatAttemptCount(discoveryRequest.searchAttemptCount),
    },
  ];

  const lastSearchAt = formatEvidenceTimestamp(discoveryRequest.lastSearchAt);
  if (lastSearchAt) {
    details.push({ label: 'Last search', value: lastSearchAt });
  }

  const failedCandidateId = formatShortIdentifier(exhaustedEvidence.triggeredByFailedCandidateId);
  if (failedCandidateId) {
    details.push({ label: 'Failed candidate', value: failedCandidateId });
  }

  const operationRunId = formatShortIdentifier(exhaustedEvidence.sourceOperationRunId);
  if (operationRunId) {
    details.push({ label: 'Operation run', value: operationRunId });
  }

  const sourceSearchId = formatShortIdentifier(exhaustedEvidence.sourceSearchId);
  if (sourceSearchId) {
    details.push({ label: 'Search', value: sourceSearchId });
  }

  return {
    details,
    message: 'Automatic search attempts have stopped. Select Search again to look for new matches.',
    title: 'Search stopped',
  };
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function toCount(value) {
  return Number.parseInt(String(value ?? 0), 10) || 0;
}

const importReviewWorkflowStatusPriority = [
  'downloading',
  'import_pending',
  'selected',
  'failed',
  'held',
  'pending',
  'applied',
  'rejected',
];

function getImportReviewStatusCount(statusCounts, status) {
  return toCount(statusCounts?.[status]);
}

function getPrimaryImportReviewStatus(summary) {
  const statusCounts = summary?.statusCounts ?? {};
  return importReviewWorkflowStatusPriority.find((status) => getImportReviewStatusCount(statusCounts, status) > 0)
    ?? summary?.latestStatus
    ?? null;
}

function formatCandidateCount(count) {
  return `${count} ${pluralize(count, 'candidate')}`;
}

function formatScore(value) {
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed.toFixed(1).replace(/\.0$/, '') : null;
}

function buildImportReviewWorkflowDetails(summary) {
  const statusCounts = summary?.statusCounts ?? {};
  const downloadExecutionSummary = summary?.downloadExecutionSummary ?? null;
  const selectionReadiness = summary?.selectionReadiness ?? null;
  const details = [{ label: 'Candidates', value: String(toCount(summary?.totalCount)) }];
  const orderedStatuses = [
    ['pending', 'Pending'],
    ['held', 'Held'],
    ['rejected', 'Rejected'],
    ['selected', 'Selected'],
    ['downloading', 'Downloading'],
    ['import_pending', 'Import pending'],
    ['applied', 'Applied'],
    ['failed', 'Failed'],
  ];

  orderedStatuses.forEach(([status, label]) => {
    const count = getImportReviewStatusCount(statusCounts, status);
    if (count > 0) {
      details.push({ label, value: String(count) });
    }
  });

  const enqueuedTransferCount = toCount(downloadExecutionSummary?.enqueuedTransferCount);
  if (enqueuedTransferCount > 0) {
    details.push({ label: 'Downloader transfers', value: String(enqueuedTransferCount) });
  }

  const failedFilenameCount = toCount(downloadExecutionSummary?.failedFilenameCount);
  if (failedFilenameCount > 0) {
    details.push({ label: 'Queue failures', value: String(failedFilenameCount) });
  }

  const bestScore = formatScore(selectionReadiness?.bestCompositeScore);
  if (bestScore) {
    details.push({ label: 'Best score', value: bestScore });
  }

  const scoreGap = formatScore(selectionReadiness?.scoreGap);
  if (scoreGap) {
    details.push({ label: 'Score gap', value: scoreGap });
  }

  return details;
}

function buildSelectionReadinessWorkflowResult({
  details,
  primaryStatus,
  readiness,
}) {
  if (!readiness || !['pending', 'held'].includes(primaryStatus)) {
    return null;
  }

  const bestScore = formatScore(readiness.bestCompositeScore);
  const threshold = formatScore(readiness.thresholds?.minCompositeScore);
  const scoreText = bestScore && threshold ? `Best score ${bestScore} meets the ${threshold} threshold.` : null;

  switch (readiness.code) {
    case 'auto_selectable':
      return {
        details,
        label: 'Ready for selection',
        message: `${scoreText ?? 'A high-confidence candidate is available.'} Select it in Import Review to start download handoff.`,
        tone: 'info',
      };
    case 'ambiguous':
      return {
        details,
        label: 'Review candidates',
        message: 'Multiple candidates are close in score; choose one in Import Review before download handoff.',
        tone: 'warning',
      };
    case 'low_confidence':
      return {
        details,
        label: 'Needs review',
        message: bestScore
          ? `Best score ${bestScore} is below the selection threshold; review candidates before download handoff.`
          : 'Candidates need review before download handoff.',
        tone: 'warning',
      };
    case 'unscored':
      return {
        details,
        label: 'Needs review',
        message: 'Candidates have no composite score yet; review them before download handoff.',
        tone: 'warning',
      };
    default:
      return null;
  }
}

function buildDownloadExecutionWorkflowResult(summary, details) {
  const downloadExecutionSummary = summary?.downloadExecutionSummary ?? null;
  if (!downloadExecutionSummary) {
    return null;
  }

  const itemStatusCounts = downloadExecutionSummary.itemStatusCounts ?? {};
  const queueFailedCount = getImportReviewStatusCount(itemStatusCounts, 'queue_failed');
  const blockedCount = getImportReviewStatusCount(itemStatusCounts, 'blocked');
  const queuedWithWarningsCount = getImportReviewStatusCount(itemStatusCounts, 'queued_with_warnings');
  const queuedCount = getImportReviewStatusCount(itemStatusCounts, 'queued');
  const enqueuedTransferCount = toCount(downloadExecutionSummary.enqueuedTransferCount);
  const failedFilenameCount = toCount(downloadExecutionSummary.failedFilenameCount);

  if (queueFailedCount > 0) {
    return {
      details,
      label: 'Download queue failed',
      message: `${formatCandidateCount(queueFailedCount)} failed before reaching Downloader.`,
      tone: 'danger',
    };
  }

  if (failedFilenameCount > 0 && enqueuedTransferCount < 1) {
    return {
      details,
      label: 'Download queue failed',
      message: `${failedFilenameCount} file ${failedFilenameCount === 1 ? 'was' : 'were'} rejected before reaching Downloader.`,
      tone: 'danger',
    };
  }

  if (blockedCount > 0 && enqueuedTransferCount < 1) {
    return {
      details,
      label: 'Download blocked',
      message: `${formatCandidateCount(blockedCount)} blocked before Downloader enqueue.`,
      tone: 'warning',
    };
  }

  if (queuedWithWarningsCount > 0) {
    return {
      details,
      label: 'Queued with warnings',
      message: `${enqueuedTransferCount} Downloader transfer${enqueuedTransferCount === 1 ? '' : 's'} accepted with warnings.`,
      tone: 'warning',
    };
  }

  if (queuedCount > 0 || enqueuedTransferCount > 0) {
    return {
      details,
      label: 'Queued in Downloader',
      message: `${enqueuedTransferCount} Downloader transfer${enqueuedTransferCount === 1 ? '' : 's'} accepted.`,
      tone: 'warning',
    };
  }

  return null;
}

/**
 * Builds a compact operator-facing Import Review workflow summary for a wanted
 * release's latest discovery search.
 *
 * @param {object} release - Raw or normalized wanted release object.
 * @returns {{label: string, message: string, tone: 'success'|'warning'|'danger'|'info', details: Array<{label: string, value: string}>}|null}
 */
export function buildImportReviewWorkflowResult(release) {
  const summary = release?.discoveryRequest?.importReviewSummary ?? null;
  const totalCount = toCount(summary?.totalCount);
  if (totalCount < 1) {
    return null;
  }

  const primaryStatus = getPrimaryImportReviewStatus(summary);
  const primaryCount = getImportReviewStatusCount(summary.statusCounts, primaryStatus) || totalCount;
  const candidateLabel = formatCandidateCount(primaryCount);
  const needVerb = primaryCount === 1 ? 'needs' : 'need';
  const details = buildImportReviewWorkflowDetails(summary);
  const downloadExecutionResult = buildDownloadExecutionWorkflowResult(summary, details);
  if (downloadExecutionResult) {
    return downloadExecutionResult;
  }

  const selectionReadinessResult = buildSelectionReadinessWorkflowResult({
    details,
    primaryStatus,
    readiness: summary.selectionReadiness,
  });
  if (selectionReadinessResult) {
    return selectionReadinessResult;
  }

  switch (primaryStatus) {
    case 'downloading':
      return {
        details,
        label: 'Downloading',
        message: `${candidateLabel} in the download pipeline.`,
        tone: 'warning',
      };
    case 'import_pending':
      return {
        details,
        label: 'Ready to import',
        message: `${candidateLabel} waiting for a safe library add.`,
        tone: 'info',
      };
    case 'selected':
      return {
        details,
        label: 'Selected for download',
        message: `${candidateLabel} selected for download.`,
        tone: 'info',
      };
    case 'failed':
      return {
        details,
        label: 'Candidate failed',
        message: `${candidateLabel} ${needVerb} review before acquisition can continue.`,
        tone: 'danger',
      };
    case 'held':
      return {
        details,
        label: 'Held for review',
        message: `${candidateLabel} intentionally held for review.`,
        tone: 'warning',
      };
    case 'pending':
      return {
        details,
        label: 'Pending review',
        message: `${candidateLabel} waiting for review.`,
        tone: 'info',
      };
    case 'applied':
      return {
        details,
        label: 'Applied',
        message: `${candidateLabel} applied; coverage will update after reconciliation.`,
        tone: 'success',
      };
    case 'rejected':
      return {
        details,
        label: 'Rejected',
        message: `${candidateLabel} rejected during review.`,
        tone: 'danger',
      };
    default:
      return {
        details,
        label: 'Match diagnostics',
        message: `${formatCandidateCount(totalCount)} ${totalCount === 1 ? 'has' : 'have'} diagnostic workflow state.`,
        tone: 'info',
      };
  }
}

function getImportReviewWorkflowState(release) {
  const summary = release?.discoveryRequest?.importReviewSummary ?? null;
  const totalCount = toCount(summary?.totalCount);
  if (totalCount < 1) {
    return {
      primaryStatus: null,
      summary,
      totalCount,
    };
  }

  return {
    primaryStatus: getPrimaryImportReviewStatus(summary),
    summary,
    totalCount,
  };
}

function buildReadinessGuidance({
  label = 'Next step',
  message,
  title,
  tone = 'info',
}) {
  return {
    label,
    message,
    title,
    tone,
  };
}

/**
 * Builds the next operator step when a wanted release has discovery or Import
 * Review state but Downloader has not obviously started useful work yet.
 *
 * @param {object} release - Raw or normalized wanted release object.
 * @returns {{label: string, title: string, message: string, tone: 'success'|'warning'|'danger'|'info'}|null}
 */
export function buildImportExecutionReadinessGuidance(release) {
  const discoveryRequest = release?.discoveryRequest ?? null;
  if (!discoveryRequest) {
    return buildReadinessGuidance({
      message: 'Search again before Downloader can start.',
      title: 'Run discovery',
    });
  }

  const lastSearchResult = discoveryRequest.evidence?.lastSearchResult ?? null;
  const candidateCount = toCount(lastSearchResult?.candidateCount);
  const {
    primaryStatus,
    summary,
    totalCount,
  } = getImportReviewWorkflowState(release);

  if (candidateCount > 0 && totalCount < 1) {
    return buildReadinessGuidance({
      message: 'Open advanced diagnostics to inspect matching options before a download can start.',
      title: 'Open match diagnostics',
    });
  }

  if (totalCount < 1) {
    return null;
  }

  const downloadExecutionSummary = summary?.downloadExecutionSummary ?? null;
  const itemStatusCounts = downloadExecutionSummary?.itemStatusCounts ?? {};
  const enqueuedTransferCount = toCount(downloadExecutionSummary?.enqueuedTransferCount);
  const queueFailedCount = getImportReviewStatusCount(itemStatusCounts, 'queue_failed');
  const blockedCount = getImportReviewStatusCount(itemStatusCounts, 'blocked');

  if (enqueuedTransferCount > 0) {
    return buildReadinessGuidance({
      message: 'Open Downloader to track provider progress.',
      title: 'Watch Downloader',
      tone: 'success',
    });
  }

  if (queueFailedCount > 0 || blockedCount > 0) {
    return buildReadinessGuidance({
      message: 'Open advanced diagnostics and read the download diagnostic before retrying.',
      title: 'Review the download diagnostic',
      tone: queueFailedCount > 0 ? 'danger' : 'warning',
    });
  }

  switch (primaryStatus) {
    case 'selected':
      return buildReadinessGuidance({
        message: 'A match is selected. Open advanced diagnostics only if the download does not begin automatically.',
        title: 'Review download diagnostics',
      });
    case 'pending':
    case 'held':
      return buildReadinessGuidance({
        message: 'Open advanced diagnostics to inspect matching options when automatic selection needs help.',
        title: 'Review matching options',
      });
    case 'downloading':
      return buildReadinessGuidance({
        message: 'Open Downloader to track provider progress.',
        title: 'Watch Downloader',
        tone: 'success',
      });
    case 'import_pending':
      return buildReadinessGuidance({
        message: 'The completed download is waiting for a safe library add. Open advanced diagnostics only if it stays blocked.',
        title: 'Review library-add diagnostics',
      });
    case 'failed':
      return buildReadinessGuidance({
        message: 'Open advanced diagnostics to inspect the failed match and choose a retry or replacement.',
        title: 'Review failed match',
        tone: 'danger',
      });
    case 'rejected':
      return buildReadinessGuidance({
        message: 'Search again or inspect matching options before retrying the download.',
        title: 'Find another match',
        tone: 'warning',
      });
    case 'applied':
      return null;
    default:
      return buildReadinessGuidance({
        message: 'Open advanced diagnostics to inspect the current match workflow state.',
        title: 'Check match diagnostics',
      });
  }
}

function buildDiscoveryResultDetails(discoveryRequest, evidence) {
  const details = [];
  const lastSearchAt = formatEvidenceTimestamp(discoveryRequest?.lastSearchAt);
  if (lastSearchAt) {
    details.push({ label: 'Last search', value: lastSearchAt });
  }

  const lastSearchId = formatShortIdentifier(evidence?.lastSearchId);
  if (lastSearchId) {
    details.push({ label: 'Search', value: lastSearchId });
  }

  const searchAttemptCount = toCount(
    evidence?.lastSearchAttemptCount ?? discoveryRequest?.searchAttemptCount,
  );
  if (searchAttemptCount > 0) {
    details.push({ label: 'Attempts', value: String(searchAttemptCount) });
  }

  return details;
}

function getIngestionDiagnosticMessage(diagnostics) {
  const reasonCodes = Array.isArray(diagnostics?.reasonCodes) ? diagnostics.reasonCodes : [];

  if (reasonCodes.includes('no_provider_responses')) {
    return 'Soulseek returned no responses for the last search.';
  }
  if (reasonCodes.includes('ignored_uploaders') && reasonCodes.includes('all_responses_filtered')) {
    return 'Soulseek responded, but matching uploaders are currently ignored.';
  }
  if (reasonCodes.includes('blacklisted_files') && reasonCodes.includes('all_responses_filtered')) {
    return 'Soulseek responded, but every file matched a blocked title term.';
  }
  if (reasonCodes.includes('missing_uploader_identity')) {
    return 'Soulseek responded, but responses were missing uploader identity.';
  }
  if (reasonCodes.includes('malformed_file_payload')) {
    return 'Soulseek responded, but files could not be normalized into candidates.';
  }
  if (reasonCodes.includes('no_usable_files')) {
    return 'Soulseek responded without usable files.';
  }
  if (reasonCodes.includes('no_candidate_folders')) {
    return 'Soulseek responses did not contain candidate folders.';
  }

  return null;
}

function addIngestionDiagnosticDetails(details, diagnostics) {
  if (!diagnostics || typeof diagnostics !== 'object') {
    return details;
  }

  const responseCount = toCount(diagnostics.responseCount);
  if (responseCount > 0) {
    details.push({ label: 'Responses', value: String(responseCount) });
  }

  const responseFileCount = toCount(diagnostics.responseFileCount);
  if (responseFileCount > 0) {
    details.push({ label: 'Provider files', value: String(responseFileCount) });
  }

  const filteredOutCount = toCount(diagnostics.ignoredUserResponseCount)
    + toCount(diagnostics.blacklistedFileCount)
    + toCount(diagnostics.malformedFileCount)
    + toCount(diagnostics.missingUsernameResponseCount);
  if (filteredOutCount > 0) {
    details.push({ label: 'Filtered', value: String(filteredOutCount) });
  }

  const reasonCodes = Array.isArray(diagnostics.reasonCodes)
    ? diagnostics.reasonCodes.filter((reasonCode) => typeof reasonCode === 'string' && reasonCode)
    : [];
  if (reasonCodes.length > 0) {
    details.push({ label: 'Reason', value: reasonCodes.join(', ') });
  }

  return details;
}

/**
 * Builds a compact operator-facing discovery dispatch result for a wanted row.
 *
 * @param {object} release - Raw or normalized wanted release object.
 * @returns {{label: string, message: string, tone: 'success'|'warning'|'danger'|'info', details: Array<{label: string, value: string}>}}
 */
export function buildDiscoveryDispatchResult(release) {
  const discoveryRequest = release?.discoveryRequest ?? null;
  if (!discoveryRequest) {
    return {
      details: [],
      label: 'Not queued',
      message: 'Discovery has not created a search request for this release yet.',
      tone: 'info',
    };
  }

  const evidence = discoveryRequest.evidence ?? {};
  const lastDispatchFailure = evidence.lastDispatchFailure ?? null;
  if (lastDispatchFailure) {
    return {
      details: buildDiscoveryResultDetails(discoveryRequest, evidence),
      label: 'Search failed',
      message: lastDispatchFailure.message ?? 'The latest Soulseek search dispatch failed.',
      tone: 'danger',
    };
  }

  const exhausted = evidence.searchExhausted ?? null;
  if (exhausted) {
    return {
      details: [
        ...buildDiscoveryResultDetails(discoveryRequest, evidence),
        { label: 'Reason', value: exhausted.reasonCode ?? 'search_attempts_exhausted' },
      ],
      label: 'No results',
      message: 'Automatic search attempts are exhausted for this release.',
      tone: 'danger',
    };
  }

  const lastSearchResult = evidence.lastSearchResult ?? null;
  if (lastSearchResult) {
    const candidateCount = toCount(lastSearchResult.candidateCount);
    const fileCount = toCount(lastSearchResult.fileCount);
    const details = buildDiscoveryResultDetails(discoveryRequest, evidence);
    if (fileCount > 0) {
      details.push({ label: 'Files', value: String(fileCount) });
    }

    if (candidateCount > 0) {
      return {
        details,
        label: `${candidateCount} ${pluralize(candidateCount, 'candidate')}`,
        message: 'Last search found matching downloads.',
        tone: 'success',
      };
    }

    const diagnostics = lastSearchResult.ingestionDiagnostics ?? null;
    addIngestionDiagnosticDetails(details, diagnostics);
    const diagnosticMessage = getIngestionDiagnosticMessage(diagnostics);

    return {
      details,
      label: 'No candidates',
      message: diagnosticMessage ?? (discoveryRequest.requestStatus === 'cooldown'
        ? 'Last search returned no candidates; Harmoniarr will retry after cooldown.'
        : 'Last search returned no candidates.'),
      tone: discoveryRequest.requestStatus === 'blocked' ? 'danger' : 'warning',
    };
  }

  if (discoveryRequest.requestStatus === 'ready') {
    return {
      details: buildDiscoveryResultDetails(discoveryRequest, evidence),
      label: 'Ready to search',
      message: 'Queued for the next discovery dispatch run.',
      tone: 'info',
    };
  }

  if (discoveryRequest.requestStatus === 'cooldown') {
    return {
      details: buildDiscoveryResultDetails(discoveryRequest, evidence),
      label: 'Cooling down',
      message: 'Waiting before the next automatic search attempt.',
      tone: 'warning',
    };
  }

  if (discoveryRequest.requestStatus === 'blocked') {
    return {
      details: buildDiscoveryResultDetails(discoveryRequest, evidence),
      label: 'Blocked',
      message: discoveryRequest.blockedReason === 'release_date_pending'
        ? 'Waiting for the release date before searching.'
        : 'Discovery is blocked for this release.',
      tone: 'warning',
    };
  }

  return {
    details: buildDiscoveryResultDetails(discoveryRequest, evidence),
    label: 'Pending dispatch',
    message: 'Discovery state is available but no search result is recorded yet.',
    tone: 'info',
  };
}

/**
 * Returns the display label for a wanted status value.
 *
 * @param {string|null} status
 * @returns {string}
 */
export function getWantedStatusLabel(status) {
  if (status === 'missing') return 'Not in library';
  if (status === 'partial') return 'Some tracks missing';
  return status ?? 'Unknown';
}

/**
 * Returns the design-system tone for a wanted status value.
 * Suitable for use as `data-tone` on `hx-pill`.
 *
 * @param {string|null} status
 * @returns {'danger'|'warning'|'info'}
 */
export function getWantedStatusTone(status) {
  if (status === 'missing') return 'danger';
  if (status === 'partial') return 'warning';
  return 'info';
}

/**
 * Formats the track count summary for a wanted release.
 * Returns `null` if data is insufficient to produce a useful string.
 *
 * @param {object} release - A normalized or raw wanted release object.
 * @returns {string|null}
 */
export function formatWantedTrackCounts(release) {
  if (!release) return null;
  const expected = release.expectedTrackCount ?? 0;
  const matched = release.matchedTrackCount ?? 0;
  if (expected <= 0) return null;
  const trackWord = expected === 1 ? 'track' : 'tracks';
  if (matched >= expected) return `${expected} ${trackWord}`;
  return `${matched} of ${expected} ${trackWord}`;
}

/**
 * Sorts a list of wanted releases by the given field and order.
 * Operates on raw API release objects (before normalization).
 *
 * @param {Array} releases
 * @param {'artist'|'title'|'date'} field
 * @param {'asc'|'desc'} order
 * @returns {Array}
 */
export function sortWantedReleases(releases, field, order) {
  if (!Array.isArray(releases) || releases.length === 0) return releases ?? [];
  const dir = order === 'asc' ? 1 : -1;
  return [...releases].sort((a, b) => {
    let av, bv;
    if (field === 'title') {
      av = (a.releaseGroupTitle ?? '').toLowerCase();
      bv = (b.releaseGroupTitle ?? '').toLowerCase();
    } else if (field === 'date') {
      av = a.releaseDate ?? '';
      bv = b.releaseDate ?? '';
    } else {
      av = (a.artistSortName ?? a.artistName ?? '').toLowerCase();
      bv = (b.artistSortName ?? b.artistName ?? '').toLowerCase();
    }
    if (av < bv) return -dir;
    if (av > bv) return dir;
    return 0;
  });
}

/**
 * Returns the user-facing page subtitle for the Missing screen.
 *
 * @returns {string}
 */
export function buildMissingPageSubtitle() {
  return 'Selected releases that are not yet fully in your library. Start a search to add one to Music Queue.';
}

/**
 * Builds the frozen stat card array for the Missing screen.
 *
 * @param {number} monitoredCount
 * @param {number} totalWanted
 * @param {number} missingCount
 * @param {number} partialCount
 * @returns {readonly Array<{label: string, value: number, meta: string}>}
 */
export function buildMissingStatCards(monitoredCount, totalWanted, missingCount, partialCount) {
  return Object.freeze([
    Object.freeze({ label: 'Monitored artists', value: monitoredCount, meta: 'Tracked for new releases' }),
    Object.freeze({ label: 'Selected releases', value: totalWanted, meta: 'Not in library + partial' }),
    Object.freeze({ label: 'Not in library', value: missingCount, meta: 'No tracks acquired' }),
    Object.freeze({ label: 'Some tracks missing', value: partialCount, meta: 'Partly acquired' }),
  ]);
}

/**
 * Returns the subtitle for the wanted releases card, or null when count is
 * zero or absent so the subtitle element can be conditionally rendered.
 *
 * @param {number|null|undefined} count
 * @returns {string|null}
 */
export function buildWantedReleasesCardSubtitle(count) {
  if (!count || count <= 0) return null;
  if (count === 1) return '1 selected release is not yet fully in your library';
  return `${count} selected releases are not yet fully in your library`;
}

/**
 * Returns the design-system tone for a missing-screen summary status value.
 *
 * @param {string|null} status
 * @returns {'success'|'danger'|'warning'}
 */
export function getMissingSummaryTone(status) {
  if (status === 'healthy' || status === 'complete') return 'success';
  if (status === 'unavailable' || status === 'failed') return 'danger';
  return 'warning';
}

/**
 * Returns true when the summary status pill should be rendered.
 *
 * @param {string|null} status
 * @returns {boolean}
 */
export function shouldShowMissingSummaryPill(status) {
  return Boolean(status) && status !== 'empty';
}

/**
 * Returns a capitalised, user-facing label for a summary status value.
 *
 * @param {string|null} status
 * @returns {string}
 */
export function formatMissingSummaryStatus(status) {
  if (!status) return '';
  if (status === 'complete') return 'Complete';
  if (status === 'healthy') return 'Healthy';
  if (status === 'partial') return 'Partial';
  if (status === 'unavailable') return 'Unavailable';
  if (status === 'failed') return 'Failed';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Formats a `lastReconciledAt` API timestamp for user-facing display.
 * Returns 'never' for null/undefined, a locale-formatted datetime string for
 * valid ISO 8601 values, and the raw value as a fallback.
 *
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function formatLastReconciledAt(value) {
  if (!value) return 'Never updated';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return `Last updated ${d.toLocaleString()}`;
  } catch {
    return value;
  }
}
