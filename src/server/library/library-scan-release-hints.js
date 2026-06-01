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
  return typeof value === 'string' ? value.trim() : '';
}

function normalizePathKey(value) {
  return normalizeString(value).replaceAll('\\', '/');
}

function buildHintAssignments(releaseHints) {
  const canonicalPathAssignments = new Map();
  const relativePathAssignments = new Map();
  const conflictedCanonicalPaths = new Set();
  const conflictedRelativePaths = new Set();

  function assign(map, conflicts, key, metadataReleaseId) {
    if (!key) {
      return;
    }

    const existing = map.get(key);
    if (existing && existing !== metadataReleaseId) {
      conflicts.add(key);
      return;
    }

    map.set(key, metadataReleaseId);
  }

  for (const hint of releaseHints ?? []) {
    const metadataReleaseId = normalizeString(hint?.metadataReleaseId);
    if (!metadataReleaseId) {
      continue;
    }

    assign(
      canonicalPathAssignments,
      conflictedCanonicalPaths,
      normalizePathKey(hint?.canonicalPath),
      metadataReleaseId,
    );
    assign(
      relativePathAssignments,
      conflictedRelativePaths,
      normalizePathKey(hint?.relativePath),
      metadataReleaseId,
    );
  }

  return {
    canonicalPathAssignments,
    conflictedCanonicalPaths,
    conflictedRelativePaths,
    relativePathAssignments,
  };
}

export function countLibraryScanReleaseHints(releaseHints) {
  return (releaseHints ?? []).filter((hint) => normalizeString(hint?.metadataReleaseId)).length;
}

export function applyLibraryScanReleaseHints({
  files,
  releaseHints,
} = {}) {
  if (!Array.isArray(files) || files.length === 0 || !Array.isArray(releaseHints) || releaseHints.length === 0) {
    return Array.isArray(files) ? files : [];
  }

  const {
    canonicalPathAssignments,
    conflictedCanonicalPaths,
    conflictedRelativePaths,
    relativePathAssignments,
  } = buildHintAssignments(releaseHints);

  return files.map((file) => {
    const canonicalPath = normalizePathKey(file?.canonicalPath);
    const relativePath = normalizePathKey(file?.relativePath);
    const canonicalReleaseId = conflictedCanonicalPaths.has(canonicalPath)
      ? null
      : canonicalPathAssignments.get(canonicalPath);
    const relativeReleaseId = conflictedRelativePaths.has(relativePath)
      ? null
      : relativePathAssignments.get(relativePath);
    const scopeMetadataReleaseId = canonicalReleaseId ?? relativeReleaseId ?? null;

    if (!scopeMetadataReleaseId || file?.scopeMetadataReleaseId === scopeMetadataReleaseId) {
      return file;
    }

    if (file?.scopeMetadataReleaseId && file.scopeMetadataReleaseId !== scopeMetadataReleaseId) {
      return file;
    }

    return {
      ...file,
      scopeMetadataReleaseId,
    };
  });
}
