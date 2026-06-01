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

import { getPool } from '../database.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePathInput(value) {
  return typeof value === 'string' ? value.trim().replaceAll('\\', '/') : '';
}

export async function findMetadataReleaseIdBySearchId({
  queryable = null,
  searchId,
} = {}) {
  const normalizedSearchId = normalizeString(searchId);
  if (!normalizedSearchId) {
    return null;
  }

  const db = queryable ?? getPool();
  const result = await db.query(
    `
      SELECT metadata_release_id
      FROM library_discovery_requests
      WHERE evidence->>'lastSearchId' = $1
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `,
    [normalizedSearchId],
  );

  return result.rows[0]?.metadata_release_id ?? null;
}

function collectAppliedLibraryPaths(fileOperations) {
  const libraryPaths = new Set();

  for (const operation of fileOperations ?? []) {
    if (operation?.status !== 'applied') {
      continue;
    }

    const libraryPath = normalizePathInput(operation.libraryPath);
    if (libraryPath) {
      libraryPaths.add(libraryPath);
    }
  }

  return [...libraryPaths];
}

export function createImportCandidateReleaseHintService({
  findMetadataReleaseIdBySearchIdFn = findMetadataReleaseIdBySearchId,
  queryable = null,
} = {}) {
  const metadataReleaseIdBySearchId = new Map();

  async function resolveMetadataReleaseId(sourceSearchId) {
    const normalizedSearchId = normalizeString(sourceSearchId);
    if (!normalizedSearchId) {
      return null;
    }

    if (metadataReleaseIdBySearchId.has(normalizedSearchId)) {
      return metadataReleaseIdBySearchId.get(normalizedSearchId);
    }

    const metadataReleaseId = await findMetadataReleaseIdBySearchIdFn({
      queryable,
      searchId: normalizedSearchId,
    });
    metadataReleaseIdBySearchId.set(normalizedSearchId, metadataReleaseId ?? null);

    return metadataReleaseId ?? null;
  }

  async function buildPostApplyReleaseHints({
    applyResult = null,
    summaryCandidate = null,
  } = {}) {
    const metadataReleaseId = await resolveMetadataReleaseId(summaryCandidate?.sourceSearchId);
    if (!metadataReleaseId) {
      return [];
    }

    return collectAppliedLibraryPaths(applyResult?.fileOperations).map((canonicalPath) => ({
      canonicalPath,
      importCandidateId: normalizeString(summaryCandidate?.id) || null,
      metadataReleaseId,
      sourceSearchId: normalizeString(summaryCandidate?.sourceSearchId) || null,
    }));
  }

  return {
    buildPostApplyReleaseHints,
  };
}
