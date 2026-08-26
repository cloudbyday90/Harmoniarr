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

export const MISSING_MUSIC_ACCOUNT_STATUS_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Active accounts', value: 'active' }),
  Object.freeze({ label: 'Disabled account history', value: 'disabled' }),
  Object.freeze({ label: 'All accounts', value: 'all' }),
]);

export const MISSING_MUSIC_WORK_STATE_OPTIONS = Object.freeze([
  Object.freeze({ label: 'Choose an action', value: 'action' }),
  Object.freeze({ label: 'Working automatically', value: 'searching' }),
  Object.freeze({ label: 'Downloading or adding', value: 'downloading' }),
  Object.freeze({ label: 'Ready to add', value: 'ready' }),
  Object.freeze({ label: 'All states', value: 'all' }),
]);

export const DEFAULT_MISSING_MUSIC_DECISION_FILTERS = Object.freeze({
  accountStatus: 'active',
  limit: 50,
  offset: 0,
  q: '',
  requestedForUserId: '',
  scope: 'all',
  state: 'action',
});

const NEXT_STEP_LABELS = Object.freeze({
  add_to_library: 'Add to library',
  configure_provider: 'Test Soulseek connection',
  download_now: 'Start download',
  include_again: 'Include this release again',
  open_downloader: 'View in Downloader',
  open_in_library: 'Open in Library',
  recheck_library_add: 'Check the files again',
  review_add_plan: 'Review how to add the files',
  review_matches: 'Review matches',
  review_quality_choice: 'Review the quality choice',
  search_now: 'Find matches',
  set_up_folders: 'Set up music folders',
  show_advanced_diagnostics: 'Set up media tools',
  try_again: 'Try again',
  use_match: 'Use the selected match',
  view_recovery: 'Review recovery options',
});

function normalizeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim() || fallback;
}

function normalizeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function formatReleaseType(value) {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return normalized.replaceAll('_', ' ');
}

function getScopeLabel(scope, filters) {
  if (filters?.requestedForUserId) return 'the selected user';
  if (scope === 'mine') return 'your account';

  switch (filters?.accountStatus) {
    case 'all':
      return 'all accounts';
    case 'disabled':
      return 'disabled account history';
    default:
      return 'all active accounts';
  }
}

export function createMissingMusicDecisionFilters(values = {}) {
  return {
    ...DEFAULT_MISSING_MUSIC_DECISION_FILTERS,
    ...values,
    offset: 0,
    q: normalizeText(values.q),
    requestedForUserId: normalizeText(values.requestedForUserId),
  };
}

export function getMissingMusicNextStep(nextAction) {
  return NEXT_STEP_LABELS[nextAction] ?? 'Check this release';
}

export function buildMissingMusicDecisionRow(decision) {
  const release = decision?.release ?? {};
  const requestedFor = decision?.requestedFor ?? {};
  const expectedTrackCount = normalizeCount(decision?.expectedTrackCount);
  const matchedTrackCount = Math.min(normalizeCount(decision?.matchedTrackCount), expectedTrackCount);
  const releaseType = formatReleaseType(release.releaseGroupType);
  const releaseDate = normalizeText(release.releaseDate);

  return {
    accountStatus: requestedFor.accountStatus === 'disabled' ? 'disabled' : 'active',
    artistName: normalizeText(release.artistName, 'Unknown artist'),
    coverage: `${matchedTrackCount} of ${expectedTrackCount} track${expectedTrackCount === 1 ? '' : 's'} in library`,
    decisionId: normalizeText(decision?.decisionId),
    isReadOnly: requestedFor.accountStatus === 'disabled',
    nextStep: requestedFor.accountStatus === 'disabled'
      ? 'This account is disabled; its history is read-only.'
      : getMissingMusicNextStep(decision?.status?.nextAction),
    releaseMeta: [releaseType, releaseDate].filter(Boolean).join(' · '),
    statusLabel: normalizeText(decision?.status?.label, 'Waiting for an update'),
    statusMessage: normalizeText(decision?.status?.message, 'Harmoniarr is updating this release state.'),
    statusTone: normalizeText(decision?.status?.tone, 'neutral'),
    targetUserLabel: normalizeText(requestedFor.username, 'Unknown user'),
    title: normalizeText(release.title, 'Unknown release'),
  };
}

export function buildMissingMusicStatusAnnouncement(payload) {
  const decisionCount = Array.isArray(payload?.decisions) ? payload.decisions.length : 0;
  const scopeLabel = getScopeLabel(payload?.scope, payload?.filters);
  const total = normalizeCount(payload?.page?.total);

  if (decisionCount === 0) {
    return `No releases are shown for ${scopeLabel}.`;
  }

  const totalLabel = total > decisionCount ? ` of ${total}` : '';
  return `Showing ${decisionCount}${totalLabel} release${decisionCount === 1 ? '' : 's'} for ${scopeLabel}.`;
}

export function splitMissingMusicUsers(users) {
  const normalizedUsers = Array.isArray(users) ? users : [];
  return {
    active: normalizedUsers.filter((user) => user?.accountStatus !== 'disabled'),
    disabled: normalizedUsers.filter((user) => user?.accountStatus === 'disabled'),
  };
}
