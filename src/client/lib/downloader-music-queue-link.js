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

export function getDownloaderMusicQueueRelease(transfer) {
  const release = transfer?.diagnostics?.importLinkage?.musicQueueRelease;
  const wantedReleaseId = normalizeString(release?.wantedReleaseId);

  return wantedReleaseId
    ? {
        artistName: normalizeString(release.artistName),
        releaseTitle: normalizeString(release.releaseTitle),
        wantedReleaseId,
        wantedStatus: normalizeString(release.wantedStatus),
      }
    : null;
}

export function buildDownloaderMusicQueueReleaseLocation(transfer) {
  const release = getDownloaderMusicQueueRelease(transfer);
  if (!release) {
    return null;
  }

  return {
    name: 'music-queue-release',
    params: {
      wantedReleaseId: release.wantedReleaseId,
    },
  };
}

export function buildDownloaderMusicQueueReleaseLinkLabel(transfer) {
  const release = getDownloaderMusicQueueRelease(transfer);
  if (!release) {
    return 'Open Music Queue release';
  }

  const identity = [release.artistName, release.releaseTitle].filter(Boolean).join(' — ');
  return identity ? `Open Music Queue release: ${identity}` : 'Open Music Queue release';
}
