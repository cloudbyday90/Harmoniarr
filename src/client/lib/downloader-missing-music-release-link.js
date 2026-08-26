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

function normalizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Reads the durable release linkage that older transfer payloads store under
 * `musicQueueRelease`. The public destination is Missing Music; the legacy
 * payload name remains an implementation compatibility detail.
 */
export function getDownloaderMissingMusicDecision(transfer) {
  const release = transfer?.diagnostics?.importLinkage?.musicQueueRelease;
  const decisionId = normalizeString(release?.wantedReleaseId);

  return decisionId
    ? {
        artistName: normalizeString(release.artistName),
        decisionId,
        releaseTitle: normalizeString(release.releaseTitle),
        wantedStatus: normalizeString(release.wantedStatus),
      }
    : null;
}

export function buildDownloaderMissingMusicDecisionLocation(transfer) {
  const decision = getDownloaderMissingMusicDecision(transfer);
  if (!decision) {
    return null;
  }

  return {
    name: 'missing-decision',
    params: {
      decisionId: decision.decisionId,
    },
  };
}

export function buildDownloaderMissingMusicDecisionLinkLabel(transfer) {
  const decision = getDownloaderMissingMusicDecision(transfer);
  if (!decision) {
    return 'Open Missing Music release';
  }

  const identity = [decision.artistName, decision.releaseTitle].filter(Boolean).join(' — ');
  return identity ? `Open Missing Music release: ${identity}` : 'Open Missing Music release';
}
