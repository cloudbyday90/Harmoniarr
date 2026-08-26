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

function normalizeText(value, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

export function buildDownloaderMissingMusicHandoffPresentation(handoff) {
  const decisionId = normalizeText(handoff?.decisionId);
  const wantedReleaseId = normalizeText(handoff?.wantedReleaseId);
  const title = normalizeText(handoff?.release?.title, 'this release');
  const artistName = normalizeText(handoff?.release?.artistName, 'an unknown artist');
  const username = normalizeText(handoff?.requestedFor?.username, 'the selected user');
  const isReady = Boolean(decisionId && wantedReleaseId);

  return {
    copy: `Showing live transfers for ${title} by ${artistName}, requested for ${username}.`,
    emptyCopy: 'The transfer may not have started, may have completed, or may no longer be in the live queue.',
    emptyTitle: `No live transfer for ${title}`,
    isReady,
    returnLabel: `Return to ${title} in Missing Music`,
    returnLocation: isReady
      ? { name: 'missing-decision', params: { decisionId } }
      : null,
    title: `Downloads for ${title}`,
    wantedReleaseId: isReady ? wantedReleaseId : '',
  };
}
