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

export const releaseActivityPresentationSchemaVersion = 1;
export const releaseActivityPresentationType = 'release_added';

function normalizeText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePositiveInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function normalizeReleaseActivitySummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return null;
  }

  const artistName = normalizeText(summary.artistName);
  const releaseTitle = normalizeText(summary.releaseTitle);

  if (!artistName && !releaseTitle) {
    return null;
  }

  return Object.freeze({ artistName, releaseTitle });
}

function normalizeReleaseActivitySource(source) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  const operationType = normalizeText(source.operationType);
  const runId = normalizeText(source.runId);

  if (!operationType && !runId) {
    return null;
  }

  return Object.freeze({ operationType, runId });
}

function normalizeReleaseActivitySummaries(summaries) {
  if (!Array.isArray(summaries)) {
    return [];
  }

  const normalized = [];
  const seen = new Set();

  for (const summary of summaries) {
    const value = normalizeReleaseActivitySummary(summary);
    if (!value) {
      continue;
    }

    const dedupeKey = `${value.artistName ?? ''}::${value.releaseTitle ?? ''}`;
    if (seen.has(dedupeKey)) {
      continue;
    }

    seen.add(dedupeKey);
    normalized.push(value);
  }

  return normalized;
}

export function buildReleaseActivityPresentation({
  artistName = null,
  movedCount = null,
  primaryRelease = null,
  releaseCount = null,
  releases = [],
  releaseTitle = null,
  source = null,
} = {}) {
  const normalizedReleases = normalizeReleaseActivitySummaries(
    releases.length > 0
      ? releases
      : [primaryRelease ?? { artistName, releaseTitle }],
  );
  const resolvedPrimaryRelease = normalizedReleases[0] ?? null;

  return Object.freeze({
    schemaVersion: releaseActivityPresentationSchemaVersion,
    presentationType: releaseActivityPresentationType,
    movedCount: normalizePositiveInteger(movedCount),
    primaryRelease: resolvedPrimaryRelease,
    releaseCount: normalizePositiveInteger(releaseCount) ?? normalizedReleases.length,
    releases: Object.freeze(normalizedReleases),
    source: normalizeReleaseActivitySource(source),
  });
}

function normalizeLegacyReleaseActivityPresentation({ entityArtist = null, entityTitle = null, extraPayload = null } = {}) {
  const releaseSummaries = normalizeReleaseActivitySummaries(extraPayload?.releaseSummaries ?? []);
  const fallbackPrimaryRelease = normalizeReleaseActivitySummary({
    artistName: entityArtist,
    releaseTitle: entityTitle,
  });
  const normalizedReleases = releaseSummaries.length > 0
    ? releaseSummaries
    : (fallbackPrimaryRelease ? [fallbackPrimaryRelease] : []);
  const primaryRelease = normalizedReleases[0] ?? null;
  const releaseCount = normalizePositiveInteger(extraPayload?.releaseCount) ?? normalizedReleases.length;
  const movedCount = normalizePositiveInteger(extraPayload?.movedCount);

  if (!primaryRelease && releaseCount < 1 && !movedCount) {
    return null;
  }

  return Object.freeze({
    schemaVersion: releaseActivityPresentationSchemaVersion,
    presentationType: releaseActivityPresentationType,
    movedCount,
    primaryRelease,
    releaseCount,
    releases: Object.freeze(normalizedReleases),
    source: null,
  });
}

export function normalizeReleaseActivityPresentation({ entityArtist = null, entityTitle = null, extraPayload = null } = {}) {
  if (
    extraPayload
    && typeof extraPayload === 'object'
    && extraPayload.schemaVersion === releaseActivityPresentationSchemaVersion
    && extraPayload.presentationType === releaseActivityPresentationType
  ) {
    return buildReleaseActivityPresentation(extraPayload);
  }

  return normalizeLegacyReleaseActivityPresentation({ entityArtist, entityTitle, extraPayload });
}

export function formatReleaseActivitySummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return null;
  }

  const artistName = normalizeText(summary.artistName);
  const releaseTitle = normalizeText(summary.releaseTitle);

  if (releaseTitle && artistName) {
    return `${releaseTitle} by ${artistName}`;
  }

  return releaseTitle || artistName || null;
}

export function getReleaseActivityEntityTitle(presentation) {
  if (!presentation || typeof presentation !== 'object') {
    return null;
  }

  if ((presentation.releaseCount ?? 0) > 1) {
    return `${presentation.releaseCount} releases`;
  }

  return presentation.primaryRelease?.releaseTitle ?? null;
}

export function getReleaseActivityEntityArtist(presentation) {
  if (!presentation || typeof presentation !== 'object') {
    return null;
  }

  return (presentation.releaseCount ?? 0) === 1
    ? (presentation.primaryRelease?.artistName ?? null)
    : null;
}

export function formatReleaseActivitySubject(presentation, fallback = null) {
  if (presentation && typeof presentation === 'object') {
    if ((presentation.releaseCount ?? 0) > 1) {
      return `${presentation.releaseCount} releases`;
    }

    const primarySummary = formatReleaseActivitySummary(presentation.primaryRelease);
    if (primarySummary) {
      return primarySummary;
    }
  }

  return fallback;
}

export function formatReleaseActivityDetail(presentation) {
  if (!presentation || typeof presentation !== 'object') {
    return '';
  }

  const releaseCount = normalizePositiveInteger(presentation.releaseCount) ?? 0;
  const releaseSummaries = Array.isArray(presentation.releases)
    ? presentation.releases.map(formatReleaseActivitySummary).filter(Boolean)
    : [];

  if (releaseCount <= 1 || releaseSummaries.length === 0) {
    return '';
  }

  const remainingCount = Math.max(releaseCount - releaseSummaries.length, 0);
  return remainingCount > 0
    ? `Includes ${releaseSummaries.join(', ')}, and ${remainingCount} more.`
    : `Includes ${releaseSummaries.join(', ')}.`;
}
