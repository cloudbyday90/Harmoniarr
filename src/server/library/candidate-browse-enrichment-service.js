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
  selectBrowsedCandidate,
  shouldBrowseCandidate,
} from './candidate-browse-planning.js';

// Defaults bound how much remote browse work a single ingest may trigger.
const DEFAULT_MAX_BROWSE_PER_INGEST = 10;
const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function toTrustedSet(trustedUsernames) {
  if (trustedUsernames instanceof Set) {
    return trustedUsernames;
  }
  if (Array.isArray(trustedUsernames)) {
    return new Set(trustedUsernames);
  }
  return new Set();
}

/**
 * Coordinates plausibility-gated folder browse enrichment for import candidates.
 *
 * Search responses may be truncated, so for plausible candidates this service
 * fetches the complete folder listing (cache-aware) and re-normalizes it into a
 * fuller candidate before scoring. Enrichment is strictly best-effort: any
 * failure for a candidate leaves the original candidate untouched.
 *
 * @param {object} deps
 * @param {function} deps.browseUserDirectoryFn `({ username, directory }) => Promise<{ files }>`
 * @param {function} deps.normalizeSlskdResponsesFn Reuses the ingest normalizer.
 * @param {object} [deps.browseCacheStore] `{ getFreshBrowse, upsertBrowse }`
 * @param {function} [deps.nowFn]
 * @param {object} [deps.config]
 * @param {number} [deps.config.maxBrowsePerIngest]
 * @param {number} [deps.config.cacheTtlMs]
 * @param {function} [deps.logger]
 * @returns {{ enrichCandidatesWithBrowse }}
 */
export function createCandidateBrowseEnrichmentService({
  browseUserDirectoryFn,
  normalizeSlskdResponsesFn,
  browseCacheStore = null,
  nowFn = () => new Date(),
  config = {},
  logger = null,
} = {}) {
  if (typeof browseUserDirectoryFn !== 'function') {
    throw new Error('createCandidateBrowseEnrichmentService requires browseUserDirectoryFn');
  }
  if (typeof normalizeSlskdResponsesFn !== 'function') {
    throw new Error('createCandidateBrowseEnrichmentService requires normalizeSlskdResponsesFn');
  }

  const maxBrowsePerIngest = Number.isInteger(config.maxBrowsePerIngest) && config.maxBrowsePerIngest > 0
    ? config.maxBrowsePerIngest
    : DEFAULT_MAX_BROWSE_PER_INGEST;
  const cacheTtlMs = Number.isFinite(config.cacheTtlMs) && config.cacheTtlMs > 0
    ? config.cacheTtlMs
    : DEFAULT_CACHE_TTL_MS;

  function logWarning(message, error) {
    if (typeof logger === 'function') {
      logger({ level: 'warn', message, error: error?.message ?? null });
    }
  }

  /**
   * Fetches a folder's files, preferring a fresh cache entry over a remote call.
   *
   * @param {object} params
   * @param {string} params.username
   * @param {string} params.directory
   * @returns {Promise<Array<object>>} Normalized browse files (full-path filenames).
   */
  async function loadFolderFiles({ username, directory }) {
    if (browseCacheStore) {
      const freshAfter = new Date(nowFn().getTime() - cacheTtlMs);
      const cached = await browseCacheStore.getFreshBrowse({ username, directory, freshAfter });
      if (cached && Array.isArray(cached.payload?.files)) {
        return cached.payload.files;
      }
    }

    const browse = await browseUserDirectoryFn({ username, directory });
    const files = Array.isArray(browse?.files) ? browse.files : [];

    if (browseCacheStore) {
      try {
        await browseCacheStore.upsertBrowse({
          username,
          directory,
          fileCount: files.length,
          payload: { files },
        });
      } catch (error) {
        logWarning('failed to cache browse result', error);
      }
    }

    return files;
  }

  /**
   * Enriches plausible candidates in place-equivalent fashion (returns a new
   * array), browsing each candidate's folder for the complete file listing and
   * swapping in the fuller candidate when browse reveals strictly more files.
   *
   * @param {object} params
   * @param {Array<object>} params.candidates
   * @param {string} [params.albumTitle]
   * @param {number} [params.expectedTrackCount]
   * @param {Set<string>|Array<string>} [params.trustedUsernames]
   * @param {object} [params.formatPreferences]
   * @param {object} [params.musicQueueContext]
   * @param {object} [params.requestOwnership]
   * @param {string} [params.searchId]
   * @returns {Promise<Array<object>>}
   */
  async function enrichCandidatesWithBrowse({
    candidates,
    albumTitle = '',
    expectedTrackCount = null,
    trustedUsernames = null,
    formatPreferences = null,
    musicQueueContext = null,
    requestOwnership = null,
    searchId,
  }) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return Array.isArray(candidates) ? candidates : [];
    }

    const trustedSet = toTrustedSet(trustedUsernames);
    let browseBudget = maxBrowsePerIngest;
    const result = [];

    for (const candidate of candidates) {
      const decision = shouldBrowseCandidate({
        candidate,
        albumTitle,
        expectedTrackCount,
        trustedUsernames: trustedSet,
        config,
      });

      if (!decision.browse || browseBudget <= 0) {
        result.push(candidate);
        continue;
      }

      browseBudget -= 1;

      try {
        const browsedFiles = await loadFolderFiles({
          username: candidate.username,
          directory: candidate.folderPath,
        });

        const browsedCandidates = normalizeSlskdResponsesFn({
          formatPreferences,
          musicQueueContext,
          requestOwnership,
          responses: [{ username: candidate.username, files: browsedFiles }],
          searchId,
        });

        const browsedMatch = browsedCandidates.find(
          (entry) => entry.folderPath === candidate.folderPath,
        ) ?? null;

        const { candidate: chosen, usedBrowse } = selectBrowsedCandidate({
          original: candidate,
          browsed: browsedMatch,
        });

        const enriched = usedBrowse ? chosen : candidate;
        enriched.normalizedPayload = {
          ...enriched.normalizedPayload,
          browseEnrichment: {
            usedBrowse,
            reason: decision.reason,
            originalFileCount: candidate.fileCount ?? 0,
            browsedFileCount: browsedMatch?.fileCount ?? 0,
          },
        };
        result.push(enriched);
      } catch (error) {
        logWarning('browse enrichment failed for candidate', error);
        result.push(candidate);
      }
    }

    return result;
  }

  return {
    enrichCandidatesWithBrowse,
  };
}
