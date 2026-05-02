import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProviderIngestPlan, normalizeExternalMediaSource } from '../../src/server/library/external-media-source-parser.js';

test('normalizeExternalMediaSource - Spotify album URL', () => {
  const result = normalizeExternalMediaSource('https://open.spotify.com/album/2noRn2Aes5aoNVsU6iWThc');
  assert.deepEqual(result, {
    canonicalUrl: 'https://open.spotify.com/album/2noRn2Aes5aoNVsU6iWThc',
    provider: 'spotify',
    relatedIdentifier: null,
    resourceType: 'release',
    sourceIdentifier: '2noRn2Aes5aoNVsU6iWThc',
    storefront: null,
  });
});

test('normalizeExternalMediaSource - Spotify artist URL', () => {
  const result = normalizeExternalMediaSource('https://open.spotify.com/artist/7MhMgCo0Bl0Kukl93PZbYS');
  assert.deepEqual(result, {
    canonicalUrl: 'https://open.spotify.com/artist/7MhMgCo0Bl0Kukl93PZbYS',
    provider: 'spotify',
    relatedIdentifier: null,
    resourceType: 'artist',
    sourceIdentifier: '7MhMgCo0Bl0Kukl93PZbYS',
    storefront: null,
  });
});

test('normalizeExternalMediaSource - Spotify playlist URL', () => {
  const result = normalizeExternalMediaSource('https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd');
  assert.deepEqual(result, {
    canonicalUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd',
    provider: 'spotify',
    relatedIdentifier: null,
    resourceType: 'playlist',
    sourceIdentifier: '37i9dQZF1DX0XUsuxWHRQd',
    storefront: null,
  });
});

test('normalizeExternalMediaSource - Spotify track URL', () => {
  const result = normalizeExternalMediaSource('https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUIOKE');
  assert.deepEqual(result, {
    canonicalUrl: 'https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUIOKE',
    provider: 'spotify',
    relatedIdentifier: null,
    resourceType: 'track',
    sourceIdentifier: '3n3Ppam7vgaVa1iaRUIOKE',
    storefront: null,
  });
});

test('normalizeExternalMediaSource - Spotify embed URL', () => {
  const result = normalizeExternalMediaSource('https://open.spotify.com/embed/album/2noRn2Aes5aoNVsU6iWThc');
  assert.deepEqual(result, {
    canonicalUrl: 'https://open.spotify.com/album/2noRn2Aes5aoNVsU6iWThc',
    provider: 'spotify',
    relatedIdentifier: null,
    resourceType: 'release',
    sourceIdentifier: '2noRn2Aes5aoNVsU6iWThc',
    storefront: null,
  });
});

test('normalizeExternalMediaSource - YouTube playlist URL', () => {
  const result = normalizeExternalMediaSource('https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG');
  assert.deepEqual(result, {
    canonicalUrl: 'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG',
    provider: 'youtube',
    relatedIdentifier: null,
    resourceType: 'playlist',
    sourceIdentifier: 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG',
    storefront: null,
  });
});

test('normalizeExternalMediaSource - YouTube watch URL with list parameter normalizes to playlist', () => {
  const result = normalizeExternalMediaSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG');
  assert.equal(result?.resourceType, 'playlist');
  assert.equal(result?.sourceIdentifier, 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG');
});

test('normalizeExternalMediaSource - YouTube watch URL video only', () => {
  const result = normalizeExternalMediaSource('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.deepEqual(result, {
    canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    provider: 'youtube',
    relatedIdentifier: null,
    resourceType: 'video',
    sourceIdentifier: 'dQw4w9WgXcQ',
    storefront: null,
  });
});

test('normalizeExternalMediaSource - youtu.be short URL', () => {
  const result = normalizeExternalMediaSource('https://youtu.be/dQw4w9WgXcQ');
  assert.deepEqual(result, {
    canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    provider: 'youtube',
    relatedIdentifier: null,
    resourceType: 'video',
    sourceIdentifier: 'dQw4w9WgXcQ',
    storefront: null,
  });
});

test('normalizeExternalMediaSource - YouTube shorts URL', () => {
  const result = normalizeExternalMediaSource('https://www.youtube.com/shorts/dQw4w9WgXcQ');
  assert.equal(result?.resourceType, 'video');
  assert.equal(result?.sourceIdentifier, 'dQw4w9WgXcQ');
});

test('normalizeExternalMediaSource - Apple Music album URL', () => {
  const result = normalizeExternalMediaSource('https://music.apple.com/us/album/tri-repetae/1445799380');
  assert.deepEqual(result, {
    canonicalUrl: 'https://music.apple.com/us/album/1445799380',
    provider: 'apple_music',
    relatedIdentifier: null,
    resourceType: 'release',
    sourceIdentifier: '1445799380',
    storefront: 'us',
  });
});

test('normalizeExternalMediaSource - Apple Music album URL with track query param', () => {
  const result = normalizeExternalMediaSource('https://music.apple.com/us/album/tri-repetae/1445799380?i=1445799400');
  assert.equal(result?.resourceType, 'track');
  assert.equal(result?.sourceIdentifier, '1445799400');
  assert.equal(result?.relatedIdentifier, '1445799380');
  assert.equal(result?.storefront, 'us');
});

test('normalizeExternalMediaSource - Apple Music artist URL', () => {
  const result = normalizeExternalMediaSource('https://music.apple.com/us/artist/autechre/999999');
  assert.equal(result?.resourceType, 'artist');
  assert.equal(result?.sourceIdentifier, '999999');
  assert.equal(result?.storefront, 'us');
});

test('normalizeExternalMediaSource - Apple Music playlist URL', () => {
  const result = normalizeExternalMediaSource('https://music.apple.com/us/playlist/my-playlist/pl.u-abc123');
  assert.equal(result?.resourceType, 'playlist');
  assert.equal(result?.storefront, 'us');
});

test('normalizeExternalMediaSource - unsupported host returns null', () => {
  const result = normalizeExternalMediaSource('https://example.com/album/123');
  assert.equal(result, null);
});

test('normalizeExternalMediaSource - invalid URL throws validation error', () => {
  assert.throws(
    () => normalizeExternalMediaSource('not-a-url'),
    (error) => error?.code === 'validation_error',
  );
});

test('normalizeExternalMediaSource - non-http scheme throws validation error', () => {
  assert.throws(
    () => normalizeExternalMediaSource('ftp://open.spotify.com/album/123'),
    (error) => error?.code === 'validation_error',
  );
});

test('buildProviderIngestPlan - playlist source emits playlist_page intent', () => {
  const plan = buildProviderIngestPlan({
    normalizedSource: {
      canonicalUrl: 'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd',
      provider: 'spotify',
      relatedIdentifier: null,
      resourceType: 'playlist',
      sourceIdentifier: '37i9dQZF1DX0XUsuxWHRQd',
      storefront: null,
    },
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0].ingestTargetType, 'playlist_page');
  assert.equal(plan[0].pageNumber, 1);
  assert.equal(plan[0].status, 'planned');
});

test('buildProviderIngestPlan - release source emits release intent', () => {
  const plan = buildProviderIngestPlan({
    normalizedSource: {
      canonicalUrl: 'https://open.spotify.com/album/abc',
      provider: 'spotify',
      relatedIdentifier: null,
      resourceType: 'release',
      sourceIdentifier: 'abc',
      storefront: null,
    },
  });

  assert.equal(plan.length, 1);
  assert.equal(plan[0].ingestTargetType, 'release');
});

test('buildProviderIngestPlan - null source returns empty array', () => {
  const plan = buildProviderIngestPlan({ normalizedSource: null });
  assert.deepEqual(plan, []);
});
