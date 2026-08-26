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

import { getMissingMusicNextStep } from './missing-music-worklist-presentation.js';

function normalizeText(value, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function normalizeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function formatReleaseType(value) {
  const normalized = normalizeText(value);
  return normalized ? normalized.replaceAll('_', ' ') : '';
}

function formatTrackCoverage(matchedTrackCount, expectedTrackCount) {
  const trackLabel = expectedTrackCount === 1 ? 'track' : 'tracks';
  return String(matchedTrackCount) + ' of ' + String(expectedTrackCount) + ' ' + trackLabel + ' in library';
}

export function formatMissingMusicDecisionCheckedAt(value) {
  if (!value) return 'Not recorded';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function buildMissingMusicDecisionDetailPresentation(detail) {
  const decision = detail?.decision ?? {};
  const release = decision.release ?? {};
  const requestedFor = decision.requestedFor ?? {};
  const expectedTrackCount = normalizeCount(decision.expectedTrackCount);
  const matchedTrackCount = Math.min(normalizeCount(decision.matchedTrackCount), expectedTrackCount);
  const accountIsDisabled = detail?.permissions?.isReadOnly === true
    || requestedFor.accountStatus === 'disabled';
  const canStartDownload = detail?.permissions?.canStartDownload === true;
  const canViewDownloader = detail?.permissions?.canViewDownloader === true;
  const selectedMatchNeedsAdministrator = !accountIsDisabled
    && decision.status?.nextAction === 'download_now'
    && !canStartDownload;

  return {
    accountNote: accountIsDisabled
      ? 'This account is disabled. Its history is read-only.'
      : 'This is an active account.',
    artistName: normalizeText(release.artistName, 'Unknown artist'),
    checkedAt: formatMissingMusicDecisionCheckedAt(detail?.checkedAt),
    coverage: formatTrackCoverage(matchedTrackCount, expectedTrackCount),
    isReadOnly: accountIsDisabled,
    canStartDownload,
    canViewDownloader,
    downloaderLinkAccessibleLabel: `View ${normalizeText(release.title, 'this release')} downloads for ${normalizeText(requestedFor.username, 'the selected user')} in Downloader`,
    lastCheckedAt: formatMissingMusicDecisionCheckedAt(decision.lastReconciledAt),
    nextStep: accountIsDisabled
      ? 'This account is disabled; no changes can be made.'
      : selectedMatchNeedsAdministrator
        ? 'A household administrator can start the download.'
      : getMissingMusicNextStep(decision.status?.nextAction),
    releaseMeta: [formatReleaseType(release.releaseGroupType), normalizeText(release.releaseDate)]
      .filter(Boolean)
      .join(' · '),
    statusLabel: normalizeText(decision.status?.label, 'Waiting for an update'),
    statusMessage: normalizeText(decision.status?.message, 'Harmoniarr is updating this release state.'),
    statusTone: normalizeText(decision.status?.tone, 'neutral'),
    title: normalizeText(release.title, 'Unknown release'),
    username: normalizeText(requestedFor.username, 'Unknown user'),
  };
}
