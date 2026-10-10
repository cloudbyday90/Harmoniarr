/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { captureScanCatalogue } from './library-scan-catalogue-policy.js';

const isUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);

export function captureReleaseReconciliationContext(input) {
  if (!input || !isUuid(input.libraryRootId)) return null;
  const context = captureScanCatalogue({ ...input, files: [] });
  return context ? Object.freeze({ runId: context.runId, expectedLease: context.expectedLease,
    requestedLibraryRoot: context.requestedLibraryRoot, libraryRootPath: context.libraryRootPath,
    libraryRootId: input.libraryRootId }) : null;
}

export function mapReleaseCoverageRows(rows) {
  if (!Array.isArray(rows)) return null;
  const seen = new Set(); const coverage = [];
  for (const row of rows) {
    if (!row || !isUuid(row.metadata_artist_id) || !isUuid(row.metadata_release_group_id)
      || !isUuid(row.metadata_release_id) || seen.has(row.metadata_release_id)) return null;
    seen.add(row.metadata_release_id);
    const expectedTrackCount = Number(row.expected_track_count);
    const matchedTrackCount = Number(row.matched_track_count);
    const matchedFileCount = Number(row.matched_file_count);
    const duplicateTrackCount = Number(row.duplicate_track_count);
    if (![expectedTrackCount, matchedTrackCount, matchedFileCount, duplicateTrackCount]
      .every((count) => Number.isSafeInteger(count) && count >= 0)
      || expectedTrackCount === 0 || matchedTrackCount === 0 || duplicateTrackCount > matchedTrackCount
      || matchedFileCount < matchedTrackCount + duplicateTrackCount) return null;
    coverage.push(Object.freeze({
      metadataArtistId: row.metadata_artist_id,
      metadataReleaseGroupId: row.metadata_release_group_id,
      metadataReleaseId: row.metadata_release_id,
      expectedTrackCount, matchedTrackCount, matchedFileCount, duplicateTrackCount,
      missingTrackCount: Math.max(expectedTrackCount - matchedTrackCount, 0),
      reconciliationStatus: duplicateTrackCount > 0 ? 'duplicate'
        : matchedTrackCount >= expectedTrackCount ? 'complete' : 'partial',
      evidence: Object.freeze({ strategy: 'matched_track_coverage', trackCoverage: matchedTrackCount / expectedTrackCount }),
    }));
  }
  coverage.sort((first, second) => first.metadataReleaseId.localeCompare(second.metadataReleaseId));
  return Object.freeze(coverage);
}

export function sameReleaseCoverage(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second) || first.length !== second.length) return false;
  const ordered = (rows) => [...rows].sort((a, b) => a.metadataReleaseId.localeCompare(b.metadataReleaseId))
    .map((row) => [row.metadataArtistId, row.metadataReleaseGroupId, row.metadataReleaseId,
      row.expectedTrackCount, row.matchedTrackCount, row.matchedFileCount, row.duplicateTrackCount,
      row.missingTrackCount, row.reconciliationStatus, row.evidence.strategy, row.evidence.trackCoverage]);
  return JSON.stringify(ordered(first)) === JSON.stringify(ordered(second));
}

export function isCompleteReleaseReconciliationResult(result, coverage) {
  const retained = new Set(coverage.map((row) => row.metadataReleaseId));
  const expected = new Set(retained);
  return Array.isArray(result?.metadataReleaseIds) && result.metadataReleaseIds.length === expected.size
    && result.metadataReleaseIds.every((id) => expected.delete(id))
    && Array.isArray(result.deletedMetadataReleaseIds)
    && new Set(result.deletedMetadataReleaseIds).size === result.deletedMetadataReleaseIds.length
    && result.deletedMetadataReleaseIds.every((id) => isUuid(id) && !retained.has(id));
}
