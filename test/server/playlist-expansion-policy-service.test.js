import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deriveAppleMusicPlaylistExpansionRequests,
  deriveSpotifyPlaylistExpansionRequests,
  deriveYouTubePlaylistExpansionRequests,
  normalizePlaylistExpansionPolicy,
} from '../../src/server/library/playlist-expansion-policy-service.js';

const basePlaylistRow = {
  canonicalUrl: 'https://open.spotify.com/playlist/playlist-1',
  id: 'row-1',
  pageNumber: 1,
  sourceIdentifier: 'playlist-1',
  sourceProvider: 'spotify',
};

test('deriveSpotifyPlaylistExpansionRequests keeps bounded playlist expansion to unique albums and next page', () => {
  const result = deriveSpotifyPlaylistExpansionRequests({
    mediaRequestId: 'request-1',
    pageData: {
      next: 'https://api.spotify.com/v1/playlists/playlist-1/items?offset=50&limit=50',
      items: [{
        track: {
          album: { id: 'album-1', name: 'Album One', release_date: '2026-01-01' },
          artists: [{ id: 'artist-1', name: 'Artist One' }],
          id: 'track-1',
          type: 'track',
        },
      }, {
        track: {
          album: { id: 'album-1', name: 'Album One', release_date: '2026-01-01' },
          artists: [{ id: 'artist-1', name: 'Artist One' }],
          id: 'track-2',
          type: 'track',
        },
      }],
    },
    playlistExpansionPolicy: 'bounded',
    row: basePlaylistRow,
  });

  assert.equal(result.nextPageCursor, '50');
  assert.deepEqual(result.derivedRequests.map((request) => [request.ingestTargetType, request.sourceIdentifier, request.pageCursor]), [
    ['release', 'album-1', null],
    ['playlist_page', 'playlist-1', '50'],
  ]);
});

test('deriveSpotifyPlaylistExpansionRequests adds unique artists in artist discovery mode', () => {
  const result = deriveSpotifyPlaylistExpansionRequests({
    mediaRequestId: 'request-1',
    pageData: {
      items: [{
        track: {
          album: {
            artists: [{ id: 'artist-1', name: 'Artist One' }],
            id: 'album-1',
            name: 'Album One',
          },
          artists: [{ id: 'artist-1', name: 'Artist One' }],
          id: 'track-1',
          type: 'track',
        },
      }, {
        track: {
          album: {
            artists: [{ id: 'artist-1', name: 'Artist One' }],
            id: 'album-2',
            name: 'Album Two',
          },
          artists: [{ id: 'artist-1', name: 'Artist One' }],
          id: 'track-2',
          type: 'track',
        },
      }],
    },
    playlistExpansionPolicy: 'artist_discovery',
    row: basePlaylistRow,
  });

  assert.deepEqual(result.derivedRequests.map((request) => [request.ingestTargetType, request.sourceIdentifier]), [
    ['release', 'album-1'],
    ['artist', 'artist-1'],
    ['release', 'album-2'],
  ]);
});

test('deriveYouTubePlaylistExpansionRequests emits videos and preserves page token', () => {
  const result = deriveYouTubePlaylistExpansionRequests({
    mediaRequestId: 'request-1',
    pageData: {
      nextPageToken: 'token-2',
      items: [{
        snippet: {
          resourceId: { kind: 'youtube#video', videoId: 'video-1' },
          title: 'Video One',
        },
      }],
    },
    row: {
      canonicalUrl: 'https://www.youtube.com/playlist?list=playlist-1',
      pageNumber: 1,
      sourceIdentifier: 'playlist-1',
      sourceProvider: 'youtube',
    },
  });

  assert.equal(result.nextPageCursor, 'token-2');
  assert.deepEqual(result.derivedRequests.map((request) => [request.ingestTargetType, request.sourceIdentifier, request.pageCursor]), [
    ['video', 'video-1', null],
    ['playlist_page', 'playlist-1', 'token-2'],
  ]);
});

test('deriveAppleMusicPlaylistExpansionRequests supports artist discovery from track relationships', () => {
  const result = deriveAppleMusicPlaylistExpansionRequests({
    mediaRequestId: 'request-1',
    pageData: {
      data: [{
        relationships: {
          tracks: {
            data: [{
              relationships: {
                albums: { data: [{ id: 'album-1' }] },
                artists: { data: [{ id: 'artist-1' }] },
              },
            }],
            next: '/v1/catalog/us/playlists/pl.abc/tracks?offset=100&limit=100',
          },
        },
      }],
    },
    playlistExpansionPolicy: 'artist_discovery',
    row: {
      canonicalUrl: 'https://music.apple.com/us/playlist/pl.abc',
      pageNumber: 1,
      sourceIdentifier: 'pl.abc',
      sourceProvider: 'apple_music',
    },
    storefront: 'us',
  });

  assert.equal(result.nextPageCursor, '100');
  assert.deepEqual(result.derivedRequests.map((request) => [request.ingestTargetType, request.sourceIdentifier, request.pageCursor]), [
    ['release', 'album-1', null],
    ['artist', 'artist-1', null],
    ['playlist_page', 'pl.abc', '100'],
  ]);
});

test('normalizePlaylistExpansionPolicy falls back to bounded for unknown values', () => {
  assert.equal(normalizePlaylistExpansionPolicy('artist_discovery'), 'artist_discovery');
  assert.equal(normalizePlaylistExpansionPolicy('unknown'), 'bounded');
});
