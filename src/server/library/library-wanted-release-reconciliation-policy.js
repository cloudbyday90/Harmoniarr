/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { normalizeExpectedJobLease } from '../job-lease-policy.js';
import { normalizeMetadataReleaseDateForDateColumn } from '../metadata/metadata-release-date-normalization.js';

const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const isUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
const workerTypes = new Set(['library_scan', 'library_discovery_dispatch', 'metadata_artist_refresh']);
const volatileFields = new Set(['updatedAt', 'fetchedAt', 'lastReconciledAt', 'lastSavedSnapshotAt']);

function freezeJson(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freezeJson(item);
    Object.freeze(value);
  }
  return value;
}

export function captureWantedContext(input = {}) {
  if (!isObject(input)) return null;
  if (!Object.hasOwn(input, 'workerContext')) return Object.freeze({ mode: 'direct' });
  const context = input.workerContext;
  if (!isObject(context) || !workerTypes.has(context.operationType) || !isUuid(context.runId)) return null;
  const expectedLease = normalizeExpectedJobLease(context.expectedLease, { leaseKey: `${context.operationType}:${context.runId}` });
  return expectedLease ? Object.freeze({ mode: 'worker', operationType: context.operationType,
    runId: context.runId, expectedLease }) : null;
}

function canonicalUuidText(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  const body = trimmed.startsWith('{') && trimmed.endsWith('}') ? trimmed.slice(1, -1) : trimmed;
  // PostgreSQL accepts optional hyphens after each group of four hex digits.
  if (!/^[0-9a-f]{4}(?:-?[0-9a-f]{4}){7}$/iu.test(body)) return value;
  const hex = body.replaceAll('-', '').toLowerCase();
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

export function canonicalizeWantedPair({ appUserId, metadataReleaseId }) {
  return { appUserId: canonicalUuidText(appUserId), metadataReleaseId: canonicalUuidText(metadataReleaseId) };
}

export const wantedPairKey = (row) => {
  const { appUserId, metadataReleaseId } = canonicalizeWantedPair(row);
  return JSON.stringify([appUserId, metadataReleaseId]);
};

export function captureWantedSource(value) {
  if (!isObject(value)) return null;
  try {
    return freezeJson(JSON.parse(JSON.stringify(value, (key, item) => volatileFields.has(key) ? undefined : item)));
  } catch {
    return null;
  }
}

export function captureWantedRows(rows) {
  if (!Array.isArray(rows)) return null;
  const seen = new Set(); const captured = [];
  for (const row of rows) {
    if (!isObject(row) || !['appUserId', 'metadataArtistId', 'metadataReleaseGroupId', 'metadataReleaseId'].every((key) => isUuid(row[key]))) return null;
    const key = wantedPairKey(row);
    if (seen.has(key) || !['missing', 'partial'].includes(row.wantedStatus)
      || ![row.expectedTrackCount, row.matchedTrackCount, row.missingTrackCount].every(Number.isSafeInteger)
      || row.expectedTrackCount < 1 || row.matchedTrackCount < 0 || row.matchedTrackCount > row.expectedTrackCount
      || row.missingTrackCount !== row.expectedTrackCount - row.matchedTrackCount) return null;
    seen.add(key);
    const evidence = captureWantedSource(row.evidence ?? {});
    if (!evidence) return null;
    captured.push(Object.freeze({ appUserId: row.appUserId, metadataArtistId: row.metadataArtistId,
      metadataReleaseGroupId: row.metadataReleaseGroupId, metadataReleaseId: row.metadataReleaseId,
      wantedStatus: row.wantedStatus, expectedTrackCount: row.expectedTrackCount,
      matchedTrackCount: row.matchedTrackCount, missingTrackCount: row.missingTrackCount,
      releaseDate: normalizeMetadataReleaseDateForDateColumn(row.releaseDate), releaseStatus: row.releaseStatus ?? null, evidence }));
  }
  captured.sort((a, b) => wantedPairKey(a).localeCompare(wantedPairKey(b)));
  return Object.freeze(captured);
}

function comparable(value) {
  if (Array.isArray(value)) return ['array', value.map(comparable)];
  if (isObject(value)) return ['object', Object.keys(value).sort().map((key) => [key, comparable(value[key])])];
  return ['value', value];
}

export function sameWantedProjection(first, second) {
  return JSON.stringify(comparable(first)) === JSON.stringify(comparable(second));
}

export function isCompleteWantedReplacement(result, rows) {
  const retained = new Set(rows.map(wantedPairKey)); const expected = new Set(retained);
  if (!Array.isArray(result?.wantedKeys) || result.wantedKeys.length !== expected.size
    || !result.wantedKeys.every((key) => isObject(key) && expected.delete(wantedPairKey(key)))
    || !Array.isArray(result.deletedWantedKeys)) return false;
  const deleted = new Set();
  return result.deletedWantedKeys.every((key) => {
    if (!isObject(key) || !isUuid(key.appUserId) || !isUuid(key.metadataReleaseId)) return false;
    const identity = wantedPairKey(key);
    if (retained.has(identity) || deleted.has(identity)) return false;
    deleted.add(identity); return true;
  });
}
