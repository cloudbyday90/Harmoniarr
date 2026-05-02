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

export const playlistExpansionPolicies = Object.freeze({
  artistDiscovery: 'artist_discovery',
  bounded: 'bounded',
});

const supportedPlaylistExpansionPolicies = new Set(Object.values(playlistExpansionPolicies));

export function normalizePlaylistExpansionPolicy(value) {
  return supportedPlaylistExpansionPolicies.has(value)
    ? value
    : playlistExpansionPolicies.bounded;
}

function toRequestKey(request) {
  return [
    request.mediaRequestId,
    request.sourceProvider,
    request.ingestTargetType,
    request.sourceIdentifier,
    request.pageCursor ?? '',
  ].join(':');
}

export function dedupeProviderIngestRequests(requests) {
  const seen = new Set();
  const deduped = [];

  for (const request of requests) {
    const key = toRequestKey(request);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(request);
  }

  return deduped;
}

function createProviderIngestRequest({
  canonicalUrl,
  evidence = {},
  ingestTargetType,
  mediaRequestId,
  pageCursor = null,
  pageNumber = 1,
  sourceIdentifier,
  sourceProvider,
  sourceResourceType,
  status = 'planned',
}) {
  return {
    canonicalUrl,
    evidence,
    ingestTargetType,
    mediaRequestId,
    pageCursor,
    pageNumber,
    sourceIdentifier,
    sourceProvider,
    sourceResourceType,
    status,
  };
}

function parseNextOffset(nextUrl) {
  if (!nextUrl) {
    return null;
  }

  try {
    const parsed = new URL(nextUrl, 'https://api.spotify.com');
    const offset = Number.parseInt(parsed.searchParams.get('offset') ?? '', 10);
    return Number.isInteger(offset) && offset >= 0 ? String(offset) : null;
  } catch {
    return null;
  }
}

function createNextPlaylistPageRequest({ mediaRequestId, nextPageCursor, row }) {
  if (!nextPageCursor) {
    return null;
  }

  return createProviderIngestRequest({
    canonicalUrl: row.canonicalUrl,
    evidence: {
      derivedFromProviderIngestRequestId: row.id ?? null,
      pageCursor: nextPageCursor,
    },
    ingestTargetType: 'playlist_page',
    mediaRequestId,
    pageCursor: nextPageCursor,
    pageNumber: (row.pageNumber ?? 1) + 1,
    sourceIdentifier: row.sourceIdentifier,
    sourceProvider: row.sourceProvider,
    sourceResourceType: 'playlist',
  });
}

export function deriveSpotifyPlaylistExpansionRequests({
  mediaRequestId,
  pageData,
  playlistExpansionPolicy = playlistExpansionPolicies.bounded,
  row,
}) {
  const normalizedPolicy = normalizePlaylistExpansionPolicy(playlistExpansionPolicy);
  const items = pageData?.items ?? pageData?.tracks?.items ?? [];
  const albumIds = new Set();
  const artistIds = new Set();
  const derivedRequests = [];

  for (const item of items) {
    const track = item?.track;
    if (!track || track.type === 'episode') {
      continue;
    }

    const album = track.album;
    if (album?.id && !albumIds.has(album.id)) {
      albumIds.add(album.id);
      derivedRequests.push(createProviderIngestRequest({
        canonicalUrl: `https://open.spotify.com/album/${album.id}`,
        evidence: {
          albumId: album.id,
          albumName: album.name ?? null,
          expansionPolicy: normalizedPolicy,
          releaseDate: album.release_date ?? null,
        },
        ingestTargetType: 'release',
        mediaRequestId,
        sourceIdentifier: album.id,
        sourceProvider: 'spotify',
        sourceResourceType: 'release',
      }));
    }

    if (normalizedPolicy !== playlistExpansionPolicies.artistDiscovery) {
      continue;
    }

    for (const artist of album?.artists ?? track.artists ?? []) {
      if (!artist?.id || artistIds.has(artist.id)) {
        continue;
      }

      artistIds.add(artist.id);
      derivedRequests.push(createProviderIngestRequest({
        canonicalUrl: `https://open.spotify.com/artist/${artist.id}`,
        evidence: {
          artistId: artist.id,
          artistName: artist.name ?? null,
          expansionPolicy: normalizedPolicy,
        },
        ingestTargetType: 'artist',
        mediaRequestId,
        sourceIdentifier: artist.id,
        sourceProvider: 'spotify',
        sourceResourceType: 'artist',
      }));
    }
  }

  const nextPageCursor = parseNextOffset(pageData?.next ?? pageData?.tracks?.next ?? null);
  return {
    derivedRequests: dedupeProviderIngestRequests([
      ...derivedRequests,
      createNextPlaylistPageRequest({ mediaRequestId, nextPageCursor, row }),
    ].filter(Boolean)),
    nextPageCursor,
  };
}

export function deriveYouTubePlaylistExpansionRequests({ mediaRequestId, pageData, row }) {
  const items = pageData?.items ?? [];
  const videoIds = new Set();
  const derivedRequests = [];

  for (const item of items) {
    const resourceId = item?.snippet?.resourceId;
    const videoId = resourceId?.kind === 'youtube#video' ? resourceId.videoId : null;
    if (!videoId || videoIds.has(videoId)) {
      continue;
    }

    videoIds.add(videoId);
    derivedRequests.push(createProviderIngestRequest({
      canonicalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      evidence: {
        title: item.snippet?.title ?? null,
        videoId,
      },
      ingestTargetType: 'video',
      mediaRequestId,
      sourceIdentifier: videoId,
      sourceProvider: 'youtube',
      sourceResourceType: 'video',
    }));
  }

  const nextPageCursor = pageData?.nextPageToken ?? null;
  return {
    derivedRequests: dedupeProviderIngestRequests([
      ...derivedRequests,
      createNextPlaylistPageRequest({ mediaRequestId, nextPageCursor, row }),
    ].filter(Boolean)),
    nextPageCursor,
  };
}

export function deriveAppleMusicPlaylistExpansionRequests({
  mediaRequestId,
  pageData,
  playlistExpansionPolicy = playlistExpansionPolicies.bounded,
  row,
  storefront = 'us',
}) {
  const normalizedPolicy = normalizePlaylistExpansionPolicy(playlistExpansionPolicy);
  const relationships = pageData?.data?.[0]?.relationships ?? {};
  const tracks = relationships?.tracks?.data ?? [];
  const albumIds = new Set();
  const artistIds = new Set();
  const derivedRequests = [];

  for (const track of tracks) {
    const album = track?.relationships?.albums?.data?.[0];
    if (album?.id && !albumIds.has(album.id)) {
      albumIds.add(album.id);
      derivedRequests.push(createProviderIngestRequest({
        canonicalUrl: `https://music.apple.com/${storefront}/album/${album.id}`,
        evidence: {
          albumId: album.id,
          expansionPolicy: normalizedPolicy,
        },
        ingestTargetType: 'release',
        mediaRequestId,
        sourceIdentifier: album.id,
        sourceProvider: 'apple_music',
        sourceResourceType: 'release',
      }));
    }

    if (normalizedPolicy !== playlistExpansionPolicies.artistDiscovery) {
      continue;
    }

    for (const artist of track?.relationships?.artists?.data ?? []) {
      if (!artist?.id || artistIds.has(artist.id)) {
        continue;
      }

      artistIds.add(artist.id);
      derivedRequests.push(createProviderIngestRequest({
        canonicalUrl: `https://music.apple.com/${storefront}/artist/${artist.id}`,
        evidence: {
          artistId: artist.id,
          expansionPolicy: normalizedPolicy,
        },
        ingestTargetType: 'artist',
        mediaRequestId,
        sourceIdentifier: artist.id,
        sourceProvider: 'apple_music',
        sourceResourceType: 'artist',
      }));
    }
  }

  const nextPageCursor = parseNextOffset(relationships?.tracks?.next ?? null);
  return {
    derivedRequests: dedupeProviderIngestRequests([
      ...derivedRequests,
      createNextPlaylistPageRequest({ mediaRequestId, nextPageCursor, row }),
    ].filter(Boolean)),
    nextPageCursor,
  };
}
