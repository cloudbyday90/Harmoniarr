/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { captureScanCatalogue } from './library-scan-catalogue-policy.js';

const isUuid = (value) => typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value);
const isText = (value) => typeof value === 'string' && value.length > 0 && value.length <= 512 && !value.includes('\u0000');
const timestamp = (value) => value == null ? null
  : value instanceof Date ? value.toISOString() : new Date(value).toISOString();

export function captureTagSnapshotSource({ runId, expectedLease, requestedLibraryRoot, libraryRootPath, libraryRootId, file }) {
  if (!isUuid(libraryRootId) || !isUuid(file?.id) || file.fileState !== 'observed') return null;
  const captured = captureScanCatalogue({ runId, expectedLease, requestedLibraryRoot, libraryRootPath, files: [file] });
  if (!captured) return null;
  return Object.freeze({
    runId: captured.runId,
    expectedLease: captured.expectedLease,
    requestedLibraryRoot: captured.requestedLibraryRoot,
    libraryRootPath: captured.libraryRootPath,
    libraryRootId,
    file: Object.freeze({ ...captured.files[0], id: file.id, libraryRootId }),
  });
}

export function isCurrentTagSnapshotSource(current, prepared) {
  if (!current || current.id !== prepared.file.id || current.libraryRootId !== prepared.libraryRootId
    || current.rootPath !== prepared.libraryRootPath || current.canonicalPath !== prepared.file.canonicalPath
    || current.sizeBytes !== prepared.file.sizeBytes || current.fileState !== 'observed' || current.deletedAt != null) return false;
  try {
    return timestamp(current.modifiedAt) === prepared.file.modifiedAt;
  } catch {
    return false;
  }
}

function freezeJson(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freezeJson(item);
    Object.freeze(value);
  }
  return value;
}

export function captureTagSnapshotPayload(payload) {
  if (!payload || !['extracted', 'failed'].includes(payload.status) || !isText(payload.extractor)) return null;
  try {
    const selected = { status: payload.status, extractor: payload.extractor };
    for (const field of ['extractorVersion', 'audioCodec', 'bitrateKbps', 'sampleRateHz', 'bitDepth', 'channels',
      'durationMs', 'embeddedArtworkCount', 'tagFormat', 'normalizedTags', 'rawTags']) {
      selected[field] = payload[field] ?? null;
    }
    return freezeJson(JSON.parse(JSON.stringify(selected)));
  } catch {
    return null;
  }
}

export function isTagSnapshotRefusal(error) {
  return ['operation_run_lease_lost', 'operation_run_cancelled', 'operation_run_paused', 'recovery_lock_conflict',
    'library_tag_snapshot_invalid', 'library_tag_snapshot_stale', 'library_tag_snapshot_incomplete'].includes(error?.code);
}
