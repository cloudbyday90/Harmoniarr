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

export const MAX_MEDIA_INSPECTION_DIAGNOSTICS = 100;

function normalizeText(value, { maxLength = 500 } = {}) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 3)}...` : trimmed;
}

function normalizeWarning(warning) {
  if (!warning || typeof warning !== 'object') {
    return null;
  }

  const code = normalizeText(warning.code, { maxLength: 120 });
  const message = normalizeText(warning.message);

  if (!code && !message) {
    return null;
  }

  return {
    code,
    fileId: normalizeText(warning.fileId, { maxLength: 120 }),
    filename: normalizeText(warning.filename, { maxLength: 255 }),
    message,
  };
}

function listInspectionWarnings(applyPreview) {
  if (Array.isArray(applyPreview?.inspectionWarnings)) {
    return applyPreview.inspectionWarnings;
  }

  return (applyPreview?.files ?? []).flatMap((file) => (
    (file?.inspection?.warnings ?? []).map((warning) => ({
      ...warning,
      fileId: file?.fileId ?? null,
      filename: file?.filename ?? null,
    }))
  ));
}

export function buildMediaInspectionDiagnostics({
  applyPreview = null,
  candidate = null,
  maxDiagnostics = MAX_MEDIA_INSPECTION_DIAGNOSTICS,
} = {}) {
  const normalizedCandidate = {
    candidateId: normalizeText(candidate?.id, { maxLength: 120 }),
    folderPath: normalizeText(candidate?.folderPath),
    username: normalizeText(candidate?.username, { maxLength: 255 }),
  };

  return listInspectionWarnings(applyPreview)
    .map((warning) => normalizeWarning(warning))
    .filter(Boolean)
    .slice(0, Math.max(0, maxDiagnostics))
    .map((warning) => ({
      ...normalizedCandidate,
      ...warning,
    }));
}

export function normalizeMediaInspectionDiagnostics(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      return {
        candidateId: normalizeText(item.candidateId, { maxLength: 120 }),
        code: normalizeText(item.code, { maxLength: 120 }),
        fileId: normalizeText(item.fileId, { maxLength: 120 }),
        filename: normalizeText(item.filename, { maxLength: 255 }),
        folderPath: normalizeText(item.folderPath),
        message: normalizeText(item.message),
        username: normalizeText(item.username, { maxLength: 255 }),
      };
    })
    .filter((item) => item?.code || item?.message)
    .slice(0, MAX_MEDIA_INSPECTION_DIAGNOSTICS);
}
