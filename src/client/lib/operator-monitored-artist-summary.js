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

export function mapOperatorProjectionToMonitoredArtistSummary(projection) {
  const artist = projection?.artist ?? {};
  const monitoring = projection?.operator?.monitoring ?? {};
  const musicBrainzArtistId = artist.musicBrainzArtistId ?? null;
  const name = artist.name ?? null;

  if (!musicBrainzArtistId || !name) {
    return null;
  }

  return {
    addedAt: monitoring.lastSavedSnapshotAt ?? monitoring.lastReconciledAt ?? null,
    country: artist.country ?? null,
    disambiguation: artist.disambiguation ?? null,
    id: musicBrainzArtistId,
    localId: artist.id ?? monitoring.metadataArtistId ?? null,
    monitored: monitoring.isMonitored === true,
    name,
    projection,
    sortName: artist.sortName ?? name,
    type: artist.type ?? null,
  };
}

export function mapOperatorProjectionsToMonitoredArtistSummaries(projections) {
  if (!Array.isArray(projections)) {
    return [];
  }

  return projections
    .map((projection) => mapOperatorProjectionToMonitoredArtistSummary(projection))
    .filter((summary) => summary !== null);
}
