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

import {
  AUDIO_EXTENSIONS,
  normalizeMatchText,
  sequenceMatchRatio,
} from './candidate-track-matcher.js';

// Default plausibility thresholds. These are intentionally conservative so a
// browse pass is only spent on candidates that have a real chance of completing
// an album, bounding remote folder fetches against hostile/low-quality peers.
export const DEFAULT_MIN_FOLDER_NAME_RATIO = 0.6;
export const DEFAULT_MIN_PARTIAL_COVERAGE = 0.4;

/**
 * Counts a candidate's unlocked audio files. Browse only helps when there is at
 * least one usable (unlocked) audio file; locked files cannot be downloaded.
 *
 * @param {object} candidate
 * @returns {number}
 */
function countUnlockedAudioFiles(candidate) {
  const files = Array.isArray(candidate?.files) ? candidate.files : [];
  let count = 0;
  for (const file of files) {
    if (file?.isLocked) {
      continue;
    }
    const extension = typeof file?.extension === 'string' ? file.extension.toLowerCase() : '';
    if (AUDIO_EXTENSIONS.has(extension)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Extracts the trailing folder segment from a remote (Soulseek) path. Splits on
 * both separators because peers mix `\` and `/`; never resolves `..` so a path
 * cannot be used to reach outside the reported folder.
 *
 * @param {string} folderPath
 * @returns {string}
 */
function folderBasename(folderPath) {
  if (typeof folderPath !== 'string') {
    return '';
  }
  const segments = folderPath.split(/[\\/]+/).filter(Boolean);
  return segments.length ? segments[segments.length - 1] : '';
}

/**
 * Decides whether a candidate folder is worth browsing for its complete file
 * listing. Search responses can be truncated, so browse fills the gap — but only
 * for plausible candidates, to bound remote fetches.
 *
 * Pure and side-effect free.
 *
 * @param {object} params
 * @param {object} params.candidate Normalized import candidate.
 * @param {string} [params.albumTitle]
 * @param {number} [params.expectedTrackCount]
 * @param {Set<string>|Array<string>} [params.trustedUsernames]
 * @param {object} [params.config]
 * @param {number} [params.config.minFolderNameRatio]
 * @param {number} [params.config.minPartialCoverage]
 * @returns {{ browse: boolean, reason: string }}
 */
export function shouldBrowseCandidate({
  candidate,
  albumTitle = '',
  expectedTrackCount = null,
  trustedUsernames = null,
  config = {},
} = {}) {
  if (!candidate || typeof candidate !== 'object') {
    return { browse: false, reason: 'no_candidate' };
  }

  const minFolderNameRatio = Number.isFinite(config.minFolderNameRatio)
    ? config.minFolderNameRatio
    : DEFAULT_MIN_FOLDER_NAME_RATIO;
  const minPartialCoverage = Number.isFinite(config.minPartialCoverage)
    ? config.minPartialCoverage
    : DEFAULT_MIN_PARTIAL_COVERAGE;

  const audioCount = countUnlockedAudioFiles(candidate);
  const coverageKnown = Number.isInteger(expectedTrackCount) && expectedTrackCount > 0;

  // Already have the full tracklist locally in the search response — no benefit.
  if (coverageKnown && audioCount >= expectedTrackCount) {
    return { browse: false, reason: 'already_complete' };
  }

  const trusted = trustedUsernames instanceof Set
    ? trustedUsernames.has(candidate.username)
    : Array.isArray(trustedUsernames) && trustedUsernames.includes(candidate.username);

  const normalizedAlbum = normalizeMatchText(albumTitle ?? '');
  const normalizedFolder = normalizeMatchText(folderBasename(candidate.folderPath));
  const folderMatch = Boolean(normalizedAlbum)
    && Boolean(normalizedFolder)
    && sequenceMatchRatio(normalizedFolder, normalizedAlbum) >= minFolderNameRatio;

  const partialButPromising = coverageKnown
    && audioCount >= Math.max(1, Math.ceil(expectedTrackCount * minPartialCoverage))
    && audioCount < expectedTrackCount;

  if (folderMatch) {
    return { browse: true, reason: 'folder_name_match' };
  }
  if (trusted) {
    return { browse: true, reason: 'trusted_uploader' };
  }
  if (partialButPromising) {
    return { browse: true, reason: 'partial_coverage' };
  }

  return { browse: false, reason: 'not_plausible' };
}

/**
 * Chooses between the original candidate and a browse-enriched candidate for the
 * same folder. The browsed result is only adopted when it strictly reveals more
 * files than the original search response (browse may legitimately return fewer
 * or stale entries, in which case the original is kept).
 *
 * Pure and side-effect free.
 *
 * @param {object} params
 * @param {object} params.original
 * @param {object|null} params.browsed
 * @returns {{ candidate: object, usedBrowse: boolean }}
 */
export function selectBrowsedCandidate({ original, browsed } = {}) {
  if (!browsed || typeof browsed !== 'object') {
    return { candidate: original, usedBrowse: false };
  }

  const originalCount = Number.isInteger(original?.fileCount) ? original.fileCount : 0;
  const browsedCount = Number.isInteger(browsed?.fileCount) ? browsed.fileCount : 0;

  if (browsedCount > originalCount) {
    return { candidate: browsed, usedBrowse: true };
  }

  return { candidate: original, usedBrowse: false };
}
