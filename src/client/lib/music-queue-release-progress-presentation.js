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

import { formatOperationTimestampShort } from './operation-run-presentation.js';

const RELEASE_PROGRESS_STAGES = Object.freeze([
  Object.freeze({ id: 'search', label: 'Search' }),
  Object.freeze({ id: 'match', label: 'Choose match' }),
  Object.freeze({ id: 'download', label: 'Download' }),
  Object.freeze({ id: 'add', label: 'Add to library' }),
]);

const PROGRESS_STEP_TO_STAGE = Object.freeze({
  add: 'add',
  complete: 'complete',
  download: 'download',
  match: 'match',
  quality: 'match',
  search: 'search',
  setup: 'search',
});

const STATUS_CODE_TO_STAGE = Object.freeze({
  adding_to_library: 'add',
  checking_matches: 'match',
  downloading: 'download',
  failed: 'search',
  in_library: 'complete',
  needs_help_adding: 'add',
  needs_setup: 'search',
  no_matches_left: 'search',
  pick_match: 'match',
  quality_choice_needed: 'match',
  queued_for_search: 'search',
  ready_to_add: 'add',
  retrying_search: 'search',
  searching: 'search',
  trying_next_match: 'download',
});

function getCount(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getCurrentStageId(release) {
  const progressStep = release?.status?.progressStep;
  if (PROGRESS_STEP_TO_STAGE[progressStep]) {
    return PROGRESS_STEP_TO_STAGE[progressStep];
  }

  return STATUS_CODE_TO_STAGE[release?.statusCode ?? release?.status?.code] ?? 'search';
}

function getStatusDetail(release, fallback) {
  return release?.status?.detail
    ?? release?.status?.message
    ?? release?.detailText
    ?? fallback;
}

function getStageState({ currentStageId, stageId, statusCode }) {
  if (currentStageId === 'complete') return 'complete';

  const currentIndex = RELEASE_PROGRESS_STAGES.findIndex((stage) => stage.id === currentStageId);
  const stageIndex = RELEASE_PROGRESS_STAGES.findIndex((stage) => stage.id === stageId);
  if (stageIndex < currentIndex) return 'complete';
  if (stageIndex > currentIndex) return 'upcoming';

  if (['failed', 'needs_help_adding', 'needs_setup', 'no_matches_left', 'quality_choice_needed'].includes(statusCode)) {
    return 'attention';
  }

  return 'current';
}

function getSearchDetail(release, state) {
  const matchCount = getCount(release?.matchSummary?.totalCount);
  if (state === 'complete') {
    return matchCount > 0
      ? `${pluralize(matchCount, 'match')} found.`
      : 'Search completed.';
  }

  if (state === 'current' || state === 'attention') {
    return getStatusDetail(release, 'Harmoniarr is checking for matches.');
  }

  return 'Starts when this release is ready to search.';
}

function getMatchDetail(release, state) {
  const selectedCount = getCount(release?.matchSummary?.selectedCount);
  if (state === 'complete') {
    return selectedCount > 0 ? 'A match was selected.' : 'Match choice completed.';
  }

  if (state === 'current' || state === 'attention') {
    return getStatusDetail(release, 'Harmoniarr is evaluating available matches.');
  }

  return 'A suitable match is selected before downloading starts.';
}

function getDownloadDetail(release, state) {
  const confirmedTransferCount = getCount(release?.matchSummary?.confirmedTransferCount);
  const latestConfirmedAt = release?.matchSummary?.latestConfirmedTransferAt ?? null;
  if (confirmedTransferCount > 0) {
    const confirmedAtLabel = latestConfirmedAt
      ? ` Confirmed ${formatOperationTimestampShort(latestConfirmedAt)}.`
      : '';
    return `${pluralize(confirmedTransferCount, 'transfer')} confirmed by Harmoniarr.${confirmedAtLabel}`;
  }

  if (state === 'complete') return 'Download stage completed.';
  if (state === 'current' || state === 'attention') {
    return state === 'attention'
      ? getStatusDetail(release, 'Download work stopped before completion.')
      : 'Waiting for Harmoniarr to confirm the download handoff.';
  }

  return 'Starts after Harmoniarr selects a match.';
}

function getAddDetail(release, state) {
  if (state === 'complete') return 'Release is in your library.';
  if (state === 'current' || state === 'attention') {
    return getStatusDetail(release, 'Harmoniarr is checking the completed files.');
  }

  return 'Starts after the download is ready.';
}

function getStageDetail(release, stageId, state) {
  switch (stageId) {
    case 'search':
      return getSearchDetail(release, state);
    case 'match':
      return getMatchDetail(release, state);
    case 'download':
      return getDownloadDetail(release, state);
    case 'add':
      return getAddDetail(release, state);
    default:
      return '';
  }
}

function getStateLabel(state) {
  switch (state) {
    case 'attention':
      return 'Stopped here';
    case 'complete':
      return 'Complete';
    case 'current':
      return 'Current';
    default:
      return 'Upcoming';
  }
}

export function buildMusicQueueReleaseProgressPresentation(release) {
  if (!release) return null;

  const currentStageId = getCurrentStageId(release);
  const statusCode = release?.statusCode ?? release?.status?.code ?? '';
  const steps = RELEASE_PROGRESS_STAGES.map((stage) => {
    const state = getStageState({ currentStageId, stageId: stage.id, statusCode });
    return {
      ...stage,
      detail: getStageDetail(release, stage.id, state),
      isCurrent: state === 'current' || state === 'attention',
      state,
      stateLabel: getStateLabel(state),
    };
  });

  const currentStep = steps.find((step) => step.isCurrent)
    ?? steps.at(-1);

  return {
    summary: currentStageId === 'complete'
      ? 'This release has completed every Music Queue step.'
      : `${currentStep.label}: ${currentStep.detail}`,
    steps,
  };
}
