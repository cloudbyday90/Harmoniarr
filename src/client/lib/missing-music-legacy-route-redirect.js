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

const MAX_DECISION_ID_LENGTH = 200;

function normalizeDecisionId(value) {
  const decisionId = typeof value === 'string' ? value.trim() : '';
  return decisionId.length > 0 && decisionId.length <= MAX_DECISION_ID_LENGTH
    ? decisionId
    : null;
}

function preserveNavigationState(to, location) {
  return {
    ...location,
    hash: typeof to?.hash === 'string' ? to.hash : '',
    query: to?.query && typeof to.query === 'object' ? to.query : {},
  };
}

/**
 * Redirects a legacy release-decision list URL to the canonical Missing Music
 * worklist. Query and fragment state remains intact, while authorization is
 * intentionally left to the server-authorized Missing Music API.
 */
export function redirectLegacyMusicQueueWorklist(to) {
  return preserveNavigationState(to, { name: 'missing' });
}

/**
 * Redirects a legacy Music Queue release URL to its canonical Missing Music
 * decision. Invalid legacy IDs fall back to the scoped worklist instead of
 * creating an invalid API request.
 */
export function redirectLegacyMusicQueueRelease(to) {
  const decisionId = normalizeDecisionId(to?.params?.wantedReleaseId);
  return preserveNavigationState(to, decisionId
    ? { name: 'missing-decision', params: { decisionId } }
    : { name: 'missing' });
}

/**
 * Redirects the old Acquisition Downloader path to the canonical Downloader
 * destination while retaining ordinary URL state. Route guards continue to
 * enforce the administrator-only Downloader policy.
 */
export function redirectLegacyAcquisitionDownloader(to) {
  return preserveNavigationState(to, { name: 'downloader' });
}
