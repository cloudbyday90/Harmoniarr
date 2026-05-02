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

const unsupportedArchiveExtensions = new Set([
  '.7z',
  '.bz2',
  '.gz',
  '.rar',
  '.tar',
  '.tgz',
  '.txz',
  '.xz',
  '.zip',
  '.zst',
]);

function normalizePathInput(value) {
  return typeof value === 'string' ? value.trim().replaceAll('\\', '/') : '';
}

function normalizeExtension(extension) {
  const normalized = typeof extension === 'string' ? extension.trim().toLowerCase() : '';
  if (!normalized) {
    return '';
  }

  return normalized.startsWith('.') ? normalized : `.${normalized}`;
}

function hasTraversalSegments(pathValue) {
  const segments = normalizePathInput(pathValue).split('/').filter(Boolean);
  return segments.some((segment) => segment === '.' || segment === '..');
}

function resolveFilename(pathValue, fallback) {
  const segments = normalizePathInput(pathValue).split('/').filter(Boolean);
  return segments.at(-1) ?? fallback;
}

export function createMediaStagingSafetyService() {
  function assessCandidateFile({ candidateId = null, file } = {}) {
    const fileId = file?.id ?? null;
    const fallbackFilename = fileId ? `candidate-${candidateId ?? 'unknown'}-${fileId}` : `candidate-${candidateId ?? 'unknown'}-file`;
    const sourceFilename = resolveFilename(file?.filename, fallbackFilename);
    const blockers = [];

    if (hasTraversalSegments(file?.filename)) {
      blockers.push({
        code: 'unsafe_source_filename_traversal',
        fileId,
        message: 'The candidate file path contains traversal segments and cannot be staged safely.',
      });
    }

    if (/[\u0000-\u001F]/.test(sourceFilename)) {
      blockers.push({
        code: 'unsafe_source_filename_control_chars',
        fileId,
        message: 'The candidate filename contains unsupported control characters and cannot be staged safely.',
      });
    }

    const extension = normalizeExtension(file?.extension);
    if (unsupportedArchiveExtensions.has(extension)) {
      blockers.push({
        code: 'archive_payload_unsupported',
        fileId,
        message: 'Archive payload files are not supported in import apply staging until guarded extraction policies are implemented.',
      });
    }

    return {
      blockers,
      sourceFilename,
    };
  }

  return {
    assessCandidateFile,
  };
}
