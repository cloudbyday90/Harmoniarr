/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { captureScanCatalogue } from './library-scan-catalogue-policy.js';
import { applyLibraryScanReleaseHints } from './library-scan-release-hints.js';
import { captureTagSnapshotSource, isCurrentTagSnapshotSource } from './library-tag-snapshot-policy.js';

const isUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
const isObject = (value) => value != null && typeof value === 'object' && !Array.isArray(value);
const isText = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && !value.includes('\u0000');
const metadataFields = ['metadataArtistId', 'metadataReleaseGroupId', 'metadataReleaseId',
  'metadataMediumId', 'metadataTrackId', 'metadataRecordingId'];

function freezeJson(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freezeJson(item);
    Object.freeze(value);
  }
  return value;
}

function captureNullableObject(value) {
  if (value == null) return null;
  if (!isObject(value)) return undefined;
  try {
    const captured = JSON.parse(JSON.stringify(value));
    return isObject(captured) ? freezeJson(captured) : undefined;
  } catch {
    return undefined;
  }
}

function comparableJson(value) {
  if (Array.isArray(value)) return ['array', value.map(comparableJson)];
  if (isObject(value)) return ['object', Object.keys(value).sort().map((key) => [key, comparableJson(value[key])])];
  return ['value', value];
}

/** Capture the exact observed inputs before the metadata lookup can yield. */
export function captureFileMatchBatch(input) {
  if (!input || !isUuid(input.libraryRootId) || !Array.isArray(input.files)) return null;
  const context = captureScanCatalogue({ ...input, files: [] });
  if (!context) return null;
  const files = [];
  const ids = new Set();
  for (const file of input.files) {
    const source = captureTagSnapshotSource({ ...input, file });
    const tagPayload = captureNullableObject(file?.tagPayload);
    const scopeMetadataReleaseId = file?.scopeMetadataReleaseId ?? null;
    if (!source || ids.has(source.file.id) || tagPayload === undefined
      || (scopeMetadataReleaseId !== null && !isUuid(scopeMetadataReleaseId))) return null;
    ids.add(source.file.id);
    files.push(Object.freeze({ ...source.file, tagPayload, scopeMetadataReleaseId }));
  }
  return Object.freeze({ ...context, libraryRootId: input.libraryRootId, files: Object.freeze(files) });
}

export function isCurrentFileMatchSource(current, prepared, file) {
  if (!isCurrentTagSnapshotSource(current, { ...prepared, file })) return false;
  const currentTags = captureNullableObject(current.tagPayload);
  return currentTags !== undefined
    && JSON.stringify(comparableJson(currentTags)) === JSON.stringify(comparableJson(file.tagPayload));
}

export function isCurrentFileMatchScope(run, prepared) {
  if (run.summary?.releaseHints != null && !Array.isArray(run.summary.releaseHints)) return false;
  const current = applyLibraryScanReleaseHints({
    files: prepared.files.map((file) => ({ ...file, scopeMetadataReleaseId: null })),
    releaseHints: run.summary?.releaseHints ?? [],
  });
  return current.every((file, index) => (file.scopeMetadataReleaseId ?? null) === prepared.files[index].scopeMetadataReleaseId);
}

export function captureFileMatchResults(matches, prepared) {
  if (!Array.isArray(matches) || matches.length !== prepared.files.length) return null;
  const expected = new Set(prepared.files.map((file) => file.id));
  const captured = [];
  for (const match of matches) {
    if (!match || !expected.delete(match.libraryFileId) || !['matched', 'ambiguous', 'unmatched'].includes(match.matchStatus)
      || !['high', 'medium', 'low'].includes(match.confidence) || !isText(match.matchedBy)) return null;
    const evidence = captureNullableObject(match.evidence);
    if (evidence === undefined) return null;
    const result = { libraryFileId: match.libraryFileId, matchStatus: match.matchStatus,
      confidence: match.confidence, matchedBy: match.matchedBy, evidence };
    for (const field of metadataFields) {
      const value = match[field] ?? null;
      if ((value !== null && !isUuid(value))
        || (match.matchStatus === 'matched' && field !== 'metadataRecordingId' && value === null)) return null;
      result[field] = value;
    }
    captured.push(Object.freeze(result));
  }
  return Object.freeze(captured);
}
