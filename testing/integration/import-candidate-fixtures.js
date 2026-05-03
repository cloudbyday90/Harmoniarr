/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { randomUUID } from 'node:crypto';
import {
  replaceImportCandidateFiles,
  upsertImportCandidate,
} from '../../src/server/import-candidates/import-candidate-repository.js';

function buildDefaultFiles(folderPath) {
  return [
    {
      bitDepth: 16,
      bitRateKbps: 900,
      extension: 'flac',
      filename: '01 Foil.flac',
      folderPath,
      isLocked: false,
      lengthSeconds: 322,
      rawPayload: {
        bitDepth: 16,
        bitRate: 900,
        filename: `${folderPath}\\01 Foil.flac`,
        isLocked: false,
        length: 322,
        sampleRate: 44100,
        size: 42_000_000,
      },
      sampleRateHz: 44_100,
      sizeBytes: 42_000_000,
      sourceFileIndex: 0,
    },
  ];
}

function normalizeFiles(files, folderPath) {
  return files.map((file, index) => ({
    ...file,
    folderPath: file.folderPath ?? folderPath,
    rawPayload: file.rawPayload ?? {
      bitDepth: file.bitDepth ?? null,
      bitRate: file.bitRateKbps ?? null,
      filename: `${file.folderPath ?? folderPath}\\${file.filename}`,
      isLocked: Boolean(file.isLocked),
      length: file.lengthSeconds ?? null,
      sampleRate: file.sampleRateHz ?? null,
      size: file.sizeBytes ?? null,
    },
    sourceFileIndex: file.sourceFileIndex ?? index,
  }));
}

export function buildImportCandidateFixture({
  candidateOverrides = {},
  files = null,
} = {}) {
  const folderPath = candidateOverrides.folderPath ?? 'Autechre\\Amber';
  const normalizedFiles = normalizeFiles(files ?? buildDefaultFiles(folderPath), folderPath);
  const lockedFileCount = normalizedFiles.filter((file) => file.isLocked).length;
  const totalSizeBytes = normalizedFiles.reduce((total, file) => total + (file.sizeBytes ?? 0), 0);
  const sourceSearchId = candidateOverrides.sourceSearchId ?? `search-${randomUUID()}`;
  const sourceResponseKey = candidateOverrides.sourceResponseKey
    ?? `response-${candidateOverrides.username ?? 'source-user'}-${randomUUID()}`;

  return {
    candidate: {
      candidateType: 'manual_search',
      discoveredAt: candidateOverrides.discoveredAt ?? '2026-05-03T12:00:00.000Z',
      folderPath,
      normalizedPayload: candidateOverrides.normalizedPayload ?? {
        extensions: Array.from(new Set(normalizedFiles.map((file) => file.extension).filter(Boolean))).sort(),
        fileCount: normalizedFiles.length,
        folderPath,
        hasFreeUploadSlot: true,
        lockedFileCount,
        queueLength: 0,
        totalSizeBytes,
        uploadSpeed: 2_048,
        username: candidateOverrides.username ?? 'source-user',
      },
      rawPayload: candidateOverrides.rawPayload ?? {
        folderPath,
        response: {
          files: normalizedFiles.filter((file) => !file.isLocked).map((file) => file.rawPayload),
          hasFreeUploadSlot: true,
          lockedFiles: normalizedFiles.filter((file) => file.isLocked).map((file) => file.rawPayload),
          queueLength: 0,
          uploadSpeed: 2_048,
          username: candidateOverrides.username ?? 'source-user',
        },
        username: candidateOverrides.username ?? 'source-user',
      },
      sourceProvider: 'slskd',
      sourceResponseKey,
      sourceSearchId,
      status: 'pending',
      username: 'source-user',
      ...candidateOverrides,
      fileCount: candidateOverrides.fileCount ?? normalizedFiles.length,
      lockedFileCount: candidateOverrides.lockedFileCount ?? lockedFileCount,
      totalSizeBytes: candidateOverrides.totalSizeBytes ?? totalSizeBytes,
    },
    files: normalizedFiles,
  };
}

export async function seedImportCandidateFixture({
  candidateOverrides = {},
  files = null,
  queryable,
} = {}) {
  const fixture = buildImportCandidateFixture({
    candidateOverrides,
    files,
  });
  const storedCandidate = await upsertImportCandidate(fixture.candidate, queryable);
  const storedFiles = await replaceImportCandidateFiles(storedCandidate.id, fixture.files, queryable);

  return {
    ...storedCandidate,
    files: storedFiles,
  };
}
