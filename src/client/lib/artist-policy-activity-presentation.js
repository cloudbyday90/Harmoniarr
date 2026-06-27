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

function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function appendIfPositive(parts, count, label, plural = `${label}s`) {
  if (Number.isFinite(count) && count > 0) {
    parts.push(pluralize(count, label, plural));
  }
}

function getChangeCounts(extraPayload = {}) {
  return extraPayload?.changes ?? {};
}

export function formatArtistPolicyActivityDetail(extraPayload = {}) {
  const changes = getChangeCounts(extraPayload);
  const releaseGroups = changes.releaseGroups ?? {};
  const trackOverrides = changes.trackOverrides ?? {};
  const monitoring = changes.monitoring ?? {};
  const parts = [];

  appendIfPositive(parts, monitoring.changedFieldCount, 'monitoring field');
  appendIfPositive(
    parts,
    (releaseGroups.added ?? 0) + (releaseGroups.changed ?? 0) + (releaseGroups.removed ?? 0),
    'release selection',
  );
  appendIfPositive(
    parts,
    (trackOverrides.added ?? 0) + (trackOverrides.changed ?? 0) + (trackOverrides.removed ?? 0),
    'track override',
  );
  appendIfPositive(parts, trackOverrides.resolvedReviewCount, 'track review repaired', 'track reviews repaired');
  appendIfPositive(
    parts,
    trackOverrides.clearedReviewCount,
    'stale track review cleared',
    'stale track reviews cleared',
  );

  if (extraPayload?.reconciliation?.runId) {
    parts.push(extraPayload.reconciliation.queuedBehindRun
      ? 'reconciliation queued behind active run'
      : 'reconciliation queued');
  }

  return parts.join('; ');
}

export function getArtistPolicyActivityRouteTarget(extraPayload = {}) {
  const artistMusicBrainzId = typeof extraPayload.artistMusicBrainzId === 'string'
    ? extraPayload.artistMusicBrainzId
    : '';

  if (!artistMusicBrainzId) {
    return null;
  }

  return {
    label: 'Open artist policy',
    to: {
      name: 'artist-detail',
      params: { mbid: artistMusicBrainzId },
    },
  };
}
