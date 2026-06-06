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

export function canViewImportCandidateDiagnosticFields(actorUserRole) {
  return actorUserRole === 'admin';
}

export function buildRequesterImportCandidateSourceLabel(index = null) {
  return Number.isInteger(index) && index >= 0
    ? `Source ${index + 1}`
    : 'Source';
}

function buildRequesterImportCandidateSourceKey(index = null) {
  return Number.isInteger(index) && index >= 0
    ? `source-${index + 1}`
    : 'source';
}

function normalizeCount(value) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeBytes(value) {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function projectRequesterFormats(candidate) {
  if (!Array.isArray(candidate?.normalizedPayload?.extensions)) {
    return [];
  }

  return [...new Set(candidate.normalizedPayload.extensions
    .map((extension) => (typeof extension === 'string' ? extension.trim().toLowerCase() : ''))
    .filter(Boolean))]
    .sort();
}

export function projectRequesterImportCandidate(candidate, { index = null } = {}) {
  return {
    sourceKey: buildRequesterImportCandidateSourceKey(index),
    sourceLabel: buildRequesterImportCandidateSourceLabel(index),
    sourceProvider: candidate?.sourceProvider ?? null,
    status: candidate?.status ?? null,
    fileCount: normalizeCount(candidate?.fileCount),
    totalSizeBytes: normalizeBytes(candidate?.totalSizeBytes),
    formats: projectRequesterFormats(candidate),
    discoveredAt: candidate?.discoveredAt ?? null,
    updatedAt: candidate?.updatedAt ?? null,
  };
}

export function projectImportCandidateListResultForRead(result, { actorUserRole } = {}) {
  if (canViewImportCandidateDiagnosticFields(actorUserRole)) {
    return result;
  }

  return {
    candidates: (result?.candidates ?? []).map((candidate, index) => projectRequesterImportCandidate(candidate, {
      index,
    })),
    filters: {
      status: result?.filters?.status ?? null,
    },
    pagination: result?.pagination ?? {
      limit: 0,
      offset: 0,
      total: 0,
    },
  };
}

export function projectImportCandidateDetailForRead(candidate, { actorUserRole } = {}) {
  if (canViewImportCandidateDiagnosticFields(actorUserRole)) {
    return candidate;
  }

  return projectRequesterImportCandidate(candidate);
}
