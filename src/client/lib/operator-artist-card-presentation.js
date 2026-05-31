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

const releaseTypeLabels = Object.freeze({
  album: 'Albums',
  compilation: 'Compilations',
  ep: 'EPs',
  live: 'Live',
  single: 'Singles',
});

const releaseScopeLabels = Object.freeze({
  current_and_future: 'Current and future',
  future_only: 'Future releases',
  track_only: 'Track only',
});

const acquisitionProfileLabels = Object.freeze({
  apple_friendly_portable: 'Apple friendly',
  balanced_library: 'Balanced',
  lossless_archive: 'Lossless',
  storage_saver: 'Storage saver',
});

const wantedAutomationLabels = Object.freeze({
  current_and_future_matching: 'Current and future wanted',
  future_matching: 'Future wanted',
  manual_only: 'Manual wanted',
});

const listFormatter = new Intl.ListFormat('en', {
  style: 'short',
  type: 'conjunction',
});

function formatStatusCount(label, count) {
  return `${count} ${label}`;
}

function normalizeNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : 0;
}

export function formatOperatorReleaseTypes(types = []) {
  const labels = [...new Set(
    (Array.isArray(types) ? types : [])
      .map((type) => releaseTypeLabels[String(type).toLowerCase()])
      .filter(Boolean),
  )];

  return labels.length > 0 ? listFormatter.format(labels) : 'No release types';
}

export function formatOperatorArtistPolicySummary(monitoring = {}) {
  const releaseTypes = formatOperatorReleaseTypes(monitoring.monitoredReleaseGroupTypes);
  const releaseScope = releaseScopeLabels[monitoring.releaseScope] ?? 'Custom scope';
  const profile = acquisitionProfileLabels[monitoring.acquisitionProfileKey] ?? 'Custom profile';

  return `${releaseTypes} · ${releaseScope} · ${profile}`;
}

export function formatOperatorArtistWantedSummary(monitoring = {}) {
  return wantedAutomationLabels[monitoring.wantedAutomationMode] ?? 'Custom wanted policy';
}

export function calculateOperatorArtistCoveragePercent(coverage = {}) {
  const desired = normalizeNumber(coverage.desiredReleaseCount);
  if (desired === 0) {
    return 0;
  }

  const acquired = Math.min(normalizeNumber(coverage.acquiredReleaseCount), desired);
  return Math.round((acquired / desired) * 100);
}

export function formatOperatorArtistCoverageLine(coverage = {}) {
  const desired = normalizeNumber(coverage.desiredReleaseCount);
  if (desired === 0) {
    return 'No desired releases selected yet';
  }

  const acquired = normalizeNumber(coverage.acquiredReleaseCount);
  const segments = [`${acquired} of ${desired} desired ${desired === 1 ? 'release' : 'releases'} acquired`];

  const partial = normalizeNumber(coverage.partialReleaseCount);
  if (partial > 0) {
    segments.push(formatStatusCount('partial', partial));
  }

  const missing = normalizeNumber(coverage.missingReleaseCount);
  if (missing > 0) {
    segments.push(formatStatusCount('missing', missing));
  }

  const unresolved = normalizeNumber(coverage.unresolvedReleaseCount);
  if (unresolved > 0) {
    segments.push(formatStatusCount('unresolved', unresolved));
  }

  return segments.join(' · ');
}

export function formatOperatorArtistActivityLine(reconciliation = {}) {
  switch (reconciliation.status) {
    case 'running':
      return 'Reconciliation running';
    case 'queued':
    case 'pending':
      return 'Reconciliation queued';
    case 'completed':
      return 'Last reconciliation completed';
    case 'failed':
      return 'Last reconciliation needs attention';
    case 'cancelled':
      return 'Last reconciliation was cancelled';
    default:
      return 'Waiting for first reconciliation';
  }
}

export function getOperatorArtistActivityTone(reconciliation = {}) {
  switch (reconciliation.status) {
    case 'running':
    case 'queued':
    case 'pending':
      return 'warning';
    case 'completed':
      return 'success';
    case 'failed':
      return 'danger';
    default:
      return 'info';
  }
}

export function buildOperatorHomeStats(projections = []) {
  const artists = Array.isArray(projections) ? projections : [];
  const desired = artists.reduce(
    (sum, projection) => sum + normalizeNumber(projection.operator?.coverage?.desiredReleaseCount),
    0,
  );
  const acquired = artists.reduce(
    (sum, projection) => sum + normalizeNumber(projection.operator?.coverage?.acquiredReleaseCount),
    0,
  );
  const attention = artists.filter((projection) => {
    const operator = projection.operator ?? {};
    return operator.reconciliation?.status === 'failed'
      || normalizeNumber(operator.overview?.reviewNeededTrackOverrideCount) > 0;
  }).length;

  return [
    {
      label: 'Monitored artists',
      meta: 'Canonical recommendation basis',
      value: String(artists.length),
    },
    {
      label: 'Desired releases',
      meta: 'Selected by policy and overrides',
      value: String(desired),
    },
    {
      label: 'Acquired releases',
      meta: desired > 0 ? `${calculateOperatorArtistCoveragePercent({ acquiredReleaseCount: acquired, desiredReleaseCount: desired })}% of desired releases` : 'No desired releases yet',
      value: String(acquired),
    },
    {
      label: 'Needs review',
      meta: 'Failed reconciliation or track remap review',
      value: String(attention),
    },
  ];
}
