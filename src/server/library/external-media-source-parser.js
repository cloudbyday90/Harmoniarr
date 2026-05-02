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

import { createApiError } from '../auth.js';

function normalizeIdentifier(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function createCanonicalDescriptor({
  canonicalUrl,
  provider,
  relatedIdentifier = null,
  resourceType,
  sourceIdentifier,
  storefront = null,
}) {
  return {
    canonicalUrl,
    provider,
    relatedIdentifier,
    resourceType,
    sourceIdentifier,
    storefront,
  };
}

function parseSpotifyUrl(parsedUrl) {
  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  const resourceType = segments[0] === 'embed' ? segments[1] : segments[0];
  const sourceIdentifier = normalizeIdentifier(segments[0] === 'embed' ? segments[2] : segments[1]);

  const normalizedResourceType = {
    album: 'release',
    artist: 'artist',
    playlist: 'playlist',
    track: 'track',
  }[resourceType] ?? null;

  if (!normalizedResourceType || !sourceIdentifier) {
    return null;
  }

  return createCanonicalDescriptor({
    canonicalUrl: `https://open.spotify.com/${resourceType}/${sourceIdentifier}`,
    provider: 'spotify',
    resourceType: normalizedResourceType,
    sourceIdentifier,
  });
}

function parseYouTubeUrl(parsedUrl) {
  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  const playlistIdentifier = normalizeIdentifier(parsedUrl.searchParams.get('list'));

  if (playlistIdentifier) {
    return createCanonicalDescriptor({
      canonicalUrl: `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistIdentifier)}`,
      provider: 'youtube',
      resourceType: 'playlist',
      sourceIdentifier: playlistIdentifier,
    });
  }

  let videoIdentifier = null;
  if (parsedUrl.hostname.toLowerCase() === 'youtu.be') {
    videoIdentifier = normalizeIdentifier(segments[0]);
  } else if (segments[0] === 'watch') {
    videoIdentifier = normalizeIdentifier(parsedUrl.searchParams.get('v'));
  } else if (segments[0] === 'shorts') {
    videoIdentifier = normalizeIdentifier(segments[1]);
  }

  if (!videoIdentifier) {
    return null;
  }

  return createCanonicalDescriptor({
    canonicalUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(videoIdentifier)}`,
    provider: 'youtube',
    resourceType: 'video',
    sourceIdentifier: videoIdentifier,
  });
}

function parseAppleMusicUrl(parsedUrl) {
  const segments = parsedUrl.pathname.split('/').filter(Boolean);
  const storefront = normalizeIdentifier(segments[0]);
  const resourceSegment = segments[1];
  const terminalIdentifier = normalizeIdentifier(segments.at(-1));

  if (!storefront || !resourceSegment || !terminalIdentifier) {
    return null;
  }

  if (resourceSegment === 'playlist') {
    return createCanonicalDescriptor({
      canonicalUrl: `https://music.apple.com/${storefront}/playlist/${terminalIdentifier}`,
      provider: 'apple_music',
      resourceType: 'playlist',
      sourceIdentifier: terminalIdentifier,
      storefront,
    });
  }

  if (resourceSegment === 'artist') {
    return createCanonicalDescriptor({
      canonicalUrl: `https://music.apple.com/${storefront}/artist/${terminalIdentifier}`,
      provider: 'apple_music',
      resourceType: 'artist',
      sourceIdentifier: terminalIdentifier,
      storefront,
    });
  }

  if (resourceSegment === 'song') {
    return createCanonicalDescriptor({
      canonicalUrl: `https://music.apple.com/${storefront}/song/${terminalIdentifier}`,
      provider: 'apple_music',
      resourceType: 'track',
      sourceIdentifier: terminalIdentifier,
      storefront,
    });
  }

  if (resourceSegment === 'album') {
    const trackIdentifier = normalizeIdentifier(parsedUrl.searchParams.get('i'));

    if (trackIdentifier) {
      return createCanonicalDescriptor({
        canonicalUrl: `https://music.apple.com/${storefront}/album/${terminalIdentifier}?i=${encodeURIComponent(trackIdentifier)}`,
        provider: 'apple_music',
        relatedIdentifier: terminalIdentifier,
        resourceType: 'track',
        sourceIdentifier: trackIdentifier,
        storefront,
      });
    }

    return createCanonicalDescriptor({
      canonicalUrl: `https://music.apple.com/${storefront}/album/${terminalIdentifier}`,
      provider: 'apple_music',
      resourceType: 'release',
      sourceIdentifier: terminalIdentifier,
      storefront,
    });
  }

  return null;
}

export function normalizeExternalMediaSource(sourceUrl) {
  let parsedUrl;

  try {
    parsedUrl = new URL(sourceUrl);
  } catch {
    throw createApiError(400, 'validation_error', 'sourceUrl must be a valid absolute URL');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw createApiError(400, 'validation_error', 'sourceUrl must use http or https');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname === 'spotify.com' || hostname === 'open.spotify.com') {
    return parseSpotifyUrl(parsedUrl);
  }

  if (['youtube.com', 'www.youtube.com', 'music.youtube.com', 'youtu.be'].includes(hostname)) {
    return parseYouTubeUrl(parsedUrl);
  }

  if (hostname === 'music.apple.com') {
    return parseAppleMusicUrl(parsedUrl);
  }

  return null;
}

export function buildProviderIngestPlan({ normalizedSource }) {
  if (!normalizedSource) {
    return [];
  }

  const common = {
    canonicalUrl: normalizedSource.canonicalUrl,
    evidence: {
      relatedIdentifier: normalizedSource.relatedIdentifier,
      storefront: normalizedSource.storefront,
    },
    sourceIdentifier: normalizedSource.sourceIdentifier,
    sourceProvider: normalizedSource.provider,
    sourceResourceType: normalizedSource.resourceType,
    status: 'planned',
  };

  switch (normalizedSource.resourceType) {
    case 'playlist':
      return [{
        ...common,
        ingestTargetType: 'playlist_page',
        pageCursor: null,
        pageNumber: 1,
      }];
    case 'artist':
      return [{
        ...common,
        ingestTargetType: 'artist',
        pageCursor: null,
        pageNumber: 1,
      }];
    case 'release':
      return [{
        ...common,
        ingestTargetType: 'release',
        pageCursor: null,
        pageNumber: 1,
      }];
    case 'track':
      return [{
        ...common,
        ingestTargetType: 'track',
        pageCursor: null,
        pageNumber: 1,
      }];
    case 'video':
      return [{
        ...common,
        ingestTargetType: 'video',
        pageCursor: null,
        pageNumber: 1,
      }];
    default:
      return [];
  }
}