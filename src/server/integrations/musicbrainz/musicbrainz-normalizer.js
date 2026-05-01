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

function buildArtistCredit(artistCredit) {
  if (!Array.isArray(artistCredit)) {
    return null;
  }

  const text = artistCredit
    .map((credit) => `${credit.name ?? credit.artist?.name ?? ''}${credit.joinphrase ?? ''}`)
    .join('')
    .trim();

  return text || null;
}

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
}

function extractPrimaryArtist(release) {
  const artistEntry = Array.isArray(release['artist-credit'])
    ? release['artist-credit'].find((entry) => entry?.artist?.id)
    : null;

  if (!artistEntry?.artist?.id) {
    throw new Error('MusicBrainz release payload must include a primary artist credit');
  }

  return artistEntry.artist;
}

function extractPrimaryArtistFromReleaseGroup(releaseGroup) {
  const artistEntry = Array.isArray(releaseGroup?.['artist-credit'])
    ? releaseGroup['artist-credit'].find((entry) => entry?.artist?.id)
    : null;

  if (!artistEntry?.artist?.id) {
    throw new Error('MusicBrainz release-group payload must include a primary artist credit');
  }

  return artistEntry.artist;
}

function normalizeAliases(artistDetails) {
  if (!Array.isArray(artistDetails?.aliases)) {
    return [];
  }

  return artistDetails.aliases
    .filter((alias) => alias?.name)
    .map((alias) => ({
      alias: alias.name,
      locale: alias.locale ?? null,
      isPrimary: alias.primary ?? false,
    }));
}

export function normalizeMusicBrainzArtist({ artist, fetchedAt = new Date().toISOString() }) {
  requireObject(artist, 'artist');

  return {
    artist: {
      sourceProvider: 'musicbrainz',
      sourceArtistId: artist.id,
      musicbrainzArtistId: artist.id,
      name: artist.name,
      sortName: artist['sort-name'] ?? null,
      disambiguation: artist.disambiguation ?? null,
      country: artist.country ?? null,
      artistType: artist.type ?? null,
      beginDate: artist['life-span']?.begin ?? null,
      endDate: artist['life-span']?.end ?? null,
      rawPayload: artist,
      fetchedAt,
    },
    aliases: normalizeAliases(artist),
    providerSnapshots: [
      {
        provider: 'musicbrainz',
        entityType: 'artist',
        sourceIdentifier: artist.id,
        payloadChecksum: null,
        rawPayload: artist,
        normalizedPayload: {
          musicbrainzArtistId: artist.id,
          name: artist.name,
          sortName: artist['sort-name'] ?? null,
        },
        fetchedAt,
      },
    ],
  };
}

export function normalizeMusicBrainzReleaseGroup({
  releaseGroup,
  artistDetails = null,
  fetchedAt = new Date().toISOString(),
}) {
  requireObject(releaseGroup, 'releaseGroup');

  const primaryArtist = artistDetails?.id ? artistDetails : extractPrimaryArtistFromReleaseGroup(releaseGroup);
  const normalizedArtist = normalizeMusicBrainzArtist({
    artist: artistDetails ?? primaryArtist,
    fetchedAt,
  });

  return {
    artist: normalizedArtist.artist,
    aliases: normalizedArtist.aliases,
    releaseGroup: {
      sourceProvider: 'musicbrainz',
      sourceReleaseGroupId: releaseGroup.id,
      musicbrainzReleaseGroupId: releaseGroup.id,
      title: releaseGroup.title,
      primaryType: releaseGroup['primary-type'] ?? null,
      secondaryTypes: Array.isArray(releaseGroup['secondary-types']) ? releaseGroup['secondary-types'] : [],
      firstReleaseDate: releaseGroup['first-release-date'] ?? null,
      disambiguation: releaseGroup.disambiguation ?? null,
      rawPayload: releaseGroup,
      fetchedAt,
    },
    providerSnapshots: [
      ...normalizedArtist.providerSnapshots,
      {
        provider: 'musicbrainz',
        entityType: 'release_group',
        sourceIdentifier: releaseGroup.id,
        payloadChecksum: null,
        rawPayload: releaseGroup,
        normalizedPayload: {
          musicbrainzReleaseGroupId: releaseGroup.id,
          title: releaseGroup.title,
          primaryType: releaseGroup['primary-type'] ?? null,
        },
        fetchedAt,
      },
    ],
  };
}

function normalizeTrack(track, fallbackArtistCredit, fetchedAt) {
  requireObject(track, 'track');

  const recording = track.recording?.id
    ? {
        sourceProvider: 'musicbrainz',
        sourceRecordingId: track.recording.id,
        musicbrainzRecordingId: track.recording.id,
        title: track.recording.title ?? track.title,
        lengthMs: track.recording.length ?? track.length ?? null,
        artistCredit: buildArtistCredit(track.recording['artist-credit']) ?? fallbackArtistCredit,
        rawPayload: track.recording,
        fetchedAt,
      }
    : null;

  return {
    position: track.position,
    numberText: track.number ?? null,
    title: track.title ?? recording?.title ?? 'Unknown track',
    lengthMs: track.length ?? recording?.lengthMs ?? null,
    artistCredit: buildArtistCredit(track['artist-credit']) ?? fallbackArtistCredit,
    recording,
  };
}

export function normalizeMusicBrainzReleaseGraph({ release, artistDetails = null, fetchedAt = new Date().toISOString() }) {
  requireObject(release, 'release');

  const primaryArtist = artistDetails?.id ? artistDetails : extractPrimaryArtist(release);
  const releaseGroup = release['release-group'];

  requireObject(primaryArtist, 'primaryArtist');
  requireObject(releaseGroup, 'releaseGroup');

  const releaseArtistCredit = buildArtistCredit(release['artist-credit']);
  const normalizedMedia = Array.isArray(release.media)
    ? release.media.map((medium, index) => ({
        position: medium.position ?? index + 1,
        title: medium.title ?? null,
        format: medium.format ?? null,
        trackCount: medium['track-count'] ?? (Array.isArray(medium.tracks) ? medium.tracks.length : null),
        tracks: Array.isArray(medium.tracks)
          ? medium.tracks.map((track, trackIndex) => normalizeTrack(
              {
                ...track,
                position: track.position ?? trackIndex + 1,
              },
              releaseArtistCredit,
              fetchedAt,
            ))
          : [],
      }))
    : [];

  const normalizedArtist = normalizeMusicBrainzArtist({
    artist: artistDetails ?? primaryArtist,
    fetchedAt,
  });

  return {
    artist: normalizedArtist.artist,
    aliases: normalizedArtist.aliases,
    releaseGroup: {
      sourceProvider: 'musicbrainz',
      sourceReleaseGroupId: releaseGroup.id,
      musicbrainzReleaseGroupId: releaseGroup.id,
      title: releaseGroup.title,
      primaryType: releaseGroup['primary-type'] ?? null,
      secondaryTypes: Array.isArray(releaseGroup['secondary-types']) ? releaseGroup['secondary-types'] : [],
      firstReleaseDate: releaseGroup['first-release-date'] ?? null,
      disambiguation: releaseGroup.disambiguation ?? null,
      rawPayload: releaseGroup,
      fetchedAt,
    },
    release: {
      sourceProvider: 'musicbrainz',
      sourceReleaseId: release.id,
      musicbrainzReleaseId: release.id,
      title: release.title,
      status: release.status ?? null,
      releaseDate: release.date ?? null,
      country: release.country ?? null,
      barcode: release.barcode ?? null,
      disambiguation: release.disambiguation ?? null,
      trackCount: normalizedMedia.reduce((total, medium) => total + (medium.tracks?.length ?? 0), 0),
      mediumCount: normalizedMedia.length,
      rawPayload: release,
      fetchedAt,
    },
    media: normalizedMedia,
    providerSnapshots: [
      ...normalizedArtist.providerSnapshots,
      {
        provider: 'musicbrainz',
        entityType: 'release_group',
        sourceIdentifier: releaseGroup.id,
        payloadChecksum: null,
        rawPayload: releaseGroup,
        normalizedPayload: {
          musicbrainzReleaseGroupId: releaseGroup.id,
          title: releaseGroup.title,
        },
        fetchedAt,
      },
      {
        provider: 'musicbrainz',
        entityType: 'release',
        sourceIdentifier: release.id,
        payloadChecksum: null,
        rawPayload: release,
        normalizedPayload: {
          musicbrainzReleaseId: release.id,
          title: release.title,
        },
        fetchedAt,
      },
    ],
  };
}