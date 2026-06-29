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

import { QUALITY_DECISION_CODES } from './acquisition-quality-policy-service.js';

export const MUSIC_QUEUE_STATUS_CODES = Object.freeze({
  ADDING_TO_LIBRARY: 'adding_to_library',
  CHECKING_MATCHES: 'checking_matches',
  DOWNLOADING: 'downloading',
  FAILED: 'failed',
  IGNORED: 'ignored',
  IN_LIBRARY: 'in_library',
  NEEDS_HELP_ADDING: 'needs_help_adding',
  NEEDS_SETUP: 'needs_setup',
  NO_MATCHES_LEFT: 'no_matches_left',
  PICK_MATCH: 'pick_match',
  QUALITY_CHOICE_NEEDED: 'quality_choice_needed',
  QUEUED_FOR_SEARCH: 'queued_for_search',
  READY_TO_ADD: 'ready_to_add',
  SEARCHING: 'searching',
  TRYING_NEXT_MATCH: 'trying_next_match',
});

export const MUSIC_QUEUE_ACTION_CODES = Object.freeze({
  ADD_TO_LIBRARY: 'add_to_library',
  ALLOW_FALLBACK_QUALITY: 'allow_fallback_quality',
  CONFIGURE_PROVIDER: 'configure_provider',
  DOWNLOAD_NOW: 'download_now',
  INCLUDE_AGAIN: 'include_again',
  OPEN_DOWNLOADER: 'open_downloader',
  OPEN_IN_LIBRARY: 'open_in_library',
  REVIEW_ADD_PLAN: 'review_add_plan',
  REVIEW_MATCHES: 'review_matches',
  REVIEW_QUALITY_CHOICE: 'review_quality_choice',
  SEARCH_NOW: 'search_now',
  SET_UP_FOLDERS: 'set_up_folders',
  SHOW_ADVANCED_DIAGNOSTICS: 'show_advanced_diagnostics',
  TRY_AGAIN: 'try_again',
  USE_MATCH: 'use_match',
});

const STATUS_PRESENTATION = Object.freeze({
  [MUSIC_QUEUE_STATUS_CODES.ADDING_TO_LIBRARY]: Object.freeze({
    label: 'Adding to library',
    tone: 'info',
    message: 'Harmoniarr is moving verified files into the music library.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.CHECKING_MATCHES]: Object.freeze({
    label: 'Checking matches',
    tone: 'info',
    message: 'Search results are being scored against the release and quality profile.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.DOWNLOADING]: Object.freeze({
    label: 'Downloading',
    tone: 'info',
    message: 'A selected match is downloading.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.FAILED]: Object.freeze({
    label: 'Failed',
    tone: 'danger',
    message: 'The latest attempt failed and needs another retry or setup check.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.IGNORED]: Object.freeze({
    label: 'Ignored',
    tone: 'neutral',
    message: 'This release is currently excluded from Music Queue automation.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.IN_LIBRARY]: Object.freeze({
    label: 'In library',
    tone: 'success',
    message: 'The desired release is already in the library.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING]: Object.freeze({
    label: 'Needs help adding',
    tone: 'warning',
    message: 'Downloaded files need review before Harmoniarr can add them.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.NEEDS_SETUP]: Object.freeze({
    label: 'Needs setup',
    tone: 'warning',
    message: 'A provider or folder setting is blocking the next automatic step.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.NO_MATCHES_LEFT]: Object.freeze({
    label: 'No matches left',
    tone: 'warning',
    message: 'All known matches have been tried or rejected.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.PICK_MATCH]: Object.freeze({
    label: 'Pick a match',
    tone: 'warning',
    message: 'Harmoniarr found matches but none are safe enough to choose automatically.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.QUALITY_CHOICE_NEEDED]: Object.freeze({
    label: 'Quality choice needed',
    tone: 'warning',
    message: 'The best match does not clearly satisfy the selected quality preference.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.QUEUED_FOR_SEARCH]: Object.freeze({
    label: 'Queued for search',
    tone: 'neutral',
    message: 'This release is waiting for the next search pass.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.READY_TO_ADD]: Object.freeze({
    label: 'Ready to add',
    tone: 'success',
    message: 'Files are ready to be added to the library.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.SEARCHING]: Object.freeze({
    label: 'Searching',
    tone: 'info',
    message: 'Harmoniarr is looking for matching files.',
  }),
  [MUSIC_QUEUE_STATUS_CODES.TRYING_NEXT_MATCH]: Object.freeze({
    label: 'Trying next match',
    tone: 'info',
    message: 'The previous match failed, so the next ranked match can be tried.',
  }),
});

function buildStatus(code, { detail = null, nextAction = null, progressStep = null } = {}) {
  return {
    code,
    ...STATUS_PRESENTATION[code],
    detail,
    nextAction,
    progressStep,
  };
}

function getCount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function hasAnyStatus(statusCounts, statuses) {
  if (!statusCounts || typeof statusCounts !== 'object') return false;
  return statuses.some((status) => getCount(statusCounts[status]) > 0);
}

function hasSetupBlocker(setup) {
  return Boolean(setup?.providerBlocked || setup?.folderBlocked || setup?.mediaToolingBlocked);
}

function getSetupAction(setup) {
  if (setup?.folderBlocked) return MUSIC_QUEUE_ACTION_CODES.SET_UP_FOLDERS;
  if (setup?.providerBlocked) return MUSIC_QUEUE_ACTION_CODES.CONFIGURE_PROVIDER;
  return MUSIC_QUEUE_ACTION_CODES.SHOW_ADVANCED_DIAGNOSTICS;
}

export function deriveMusicQueueStatus({
  add = {},
  library = {},
  match = {},
  quality = {},
  release = {},
  search = {},
  setup = {},
} = {}) {
  if (release.visibilityState === 'ignored' || release.wantedStatus === 'ignored') {
    return buildStatus(MUSIC_QUEUE_STATUS_CODES.IGNORED, {
      nextAction: MUSIC_QUEUE_ACTION_CODES.INCLUDE_AGAIN,
      progressStep: 'paused',
    });
  }

  if (library.inLibrary || release.wantedStatus === 'complete' || getCount(release.missingTrackCount) === 0) {
    return buildStatus(MUSIC_QUEUE_STATUS_CODES.IN_LIBRARY, {
      nextAction: MUSIC_QUEUE_ACTION_CODES.OPEN_IN_LIBRARY,
      progressStep: 'complete',
    });
  }

  if (hasSetupBlocker(setup)) {
    return buildStatus(MUSIC_QUEUE_STATUS_CODES.NEEDS_SETUP, {
      detail: setup.message ?? null,
      nextAction: getSetupAction(setup),
      progressStep: 'setup',
    });
  }

  const executionStatusCounts = match.executionStatusCounts ?? {};
  if (hasAnyStatus(executionStatusCounts, ['running', 'pending', 'queued'])) {
    return buildStatus(MUSIC_QUEUE_STATUS_CODES.DOWNLOADING, {
      nextAction: MUSIC_QUEUE_ACTION_CODES.OPEN_DOWNLOADER,
      progressStep: 'download',
    });
  }

  if (hasAnyStatus(match.statusCounts, ['failed', 'rejected']) && getCount(match.pendingCount) > 0) {
    return buildStatus(MUSIC_QUEUE_STATUS_CODES.TRYING_NEXT_MATCH, {
      nextAction: MUSIC_QUEUE_ACTION_CODES.DOWNLOAD_NOW,
      progressStep: 'download',
    });
  }

  const selectedCount = getCount(match.statusCounts?.selected) + getCount(match.statusCounts?.held);
  if (selectedCount > 0) {
    return buildStatus(MUSIC_QUEUE_STATUS_CODES.CHECKING_MATCHES, {
      nextAction: MUSIC_QUEUE_ACTION_CODES.DOWNLOAD_NOW,
      progressStep: 'match',
    });
  }

  if (getCount(add.qualityBlockedCount) > 0 || add.latestOutcome === 'quality_blocked') {
    return buildStatus(MUSIC_QUEUE_STATUS_CODES.QUALITY_CHOICE_NEEDED, {
      detail: add.message ?? add.qualityGate?.message ?? 'Downloaded files did not pass the selected audio quality check.',
      nextAction: MUSIC_QUEUE_ACTION_CODES.REVIEW_QUALITY_CHOICE,
      progressStep: 'quality',
    });
  }

  if (hasAnyStatus(executionStatusCounts, ['completed', 'complete']) || match.latestStatus === 'import_pending') {
    return buildStatus(MUSIC_QUEUE_STATUS_CODES.READY_TO_ADD, {
      nextAction: MUSIC_QUEUE_ACTION_CODES.ADD_TO_LIBRARY,
      progressStep: 'add',
    });
  }

  if (hasAnyStatus(executionStatusCounts, ['blocked', 'apply_failed'])) {
    return buildStatus(MUSIC_QUEUE_STATUS_CODES.NEEDS_HELP_ADDING, {
      nextAction: MUSIC_QUEUE_ACTION_CODES.REVIEW_ADD_PLAN,
      progressStep: 'add',
    });
  }

  if (
    quality.code === QUALITY_DECISION_CODES.BELOW_MINIMUM
    || quality.code === QUALITY_DECISION_CODES.NEEDS_VERIFICATION
  ) {
    return buildStatus(MUSIC_QUEUE_STATUS_CODES.QUALITY_CHOICE_NEEDED, {
      detail: quality.explanation ?? null,
      nextAction: MUSIC_QUEUE_ACTION_CODES.REVIEW_QUALITY_CHOICE,
      progressStep: 'quality',
    });
  }

  if (getCount(match.totalCount) > 0) {
    if (['ambiguous', 'low_confidence', 'not_reviewable', 'unscored'].includes(match.readiness?.code)) {
      return buildStatus(MUSIC_QUEUE_STATUS_CODES.PICK_MATCH, {
        detail: match.readiness.message ?? null,
        nextAction: MUSIC_QUEUE_ACTION_CODES.REVIEW_MATCHES,
        progressStep: 'match',
      });
    }

    if (getCount(match.scoredCount) > 0) {
      return buildStatus(MUSIC_QUEUE_STATUS_CODES.PICK_MATCH, {
        nextAction: MUSIC_QUEUE_ACTION_CODES.REVIEW_MATCHES,
        progressStep: 'match',
      });
    }

    return buildStatus(MUSIC_QUEUE_STATUS_CODES.CHECKING_MATCHES, {
      nextAction: MUSIC_QUEUE_ACTION_CODES.REVIEW_MATCHES,
      progressStep: 'match',
    });
  }

  if (search.status === 'running' || search.status === 'searching') {
    return buildStatus(MUSIC_QUEUE_STATUS_CODES.SEARCHING, {
      nextAction: MUSIC_QUEUE_ACTION_CODES.SHOW_ADVANCED_DIAGNOSTICS,
      progressStep: 'search',
    });
  }

  if (search.status === 'failed') {
    return buildStatus(MUSIC_QUEUE_STATUS_CODES.FAILED, {
      detail: search.blockedReason ?? null,
      nextAction: MUSIC_QUEUE_ACTION_CODES.TRY_AGAIN,
      progressStep: 'search',
    });
  }

  if (search.status === 'completed' && getCount(search.searchAttemptCount) > 0) {
    return buildStatus(MUSIC_QUEUE_STATUS_CODES.NO_MATCHES_LEFT, {
      nextAction: MUSIC_QUEUE_ACTION_CODES.SEARCH_NOW,
      progressStep: 'search',
    });
  }

  return buildStatus(MUSIC_QUEUE_STATUS_CODES.QUEUED_FOR_SEARCH, {
    nextAction: MUSIC_QUEUE_ACTION_CODES.SEARCH_NOW,
    progressStep: 'search',
  });
}

export function createAcquisitionPipelineStatusService() {
  return {
    deriveMusicQueueStatus,
  };
}
