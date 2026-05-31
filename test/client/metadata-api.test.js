import assert from 'node:assert/strict';
import test from 'node:test';
import {
  browseMusicBrainzArtistReleaseGroups,
  fetchMetadataArtist,
  fetchMetadataArtistDetectionEvents,
  fetchMetadataRelease,
  fetchMetadataReleaseGroup,
  fetchMonitoredArtists,
  fetchMusicBrainzReleaseGroupReleases,
  fetchOperatorArtistProjection,
  fetchOperatorMonitoredArtistProjections,
  fetchReleaseGroupTracklist,
  fetchSimilarArtists,
  importMusicBrainzArtist,
  importMusicBrainzRelease,
  importMusicBrainzReleaseGroup,
  markReleaseCanonical,
  resolveMusicBrainzArtistLocal,
  resolveMusicBrainzReleaseGroupLocal,
  resolveMusicBrainzReleaseLocal,
  searchLocalMetadataArtists,
  searchLocalMetadataReleaseGroups,
  searchLocalMetadataReleases,
  searchMusicBrainzArtists,
  searchMusicBrainzReleases,
  saveOperatorArtistDraft,
  startMetadataArtistRefresh,
  updateMetadataArtistMonitoring,
} from '../../src/client/lib/metadata-api.js';

function createJsonResponse({ ok = true, payload = { ok: true }, status = 200 } = {}) {
  return {
    headers: new Headers({ 'content-type': 'application/json' }),
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

test('metadata-api GET endpoints route to correct URLs', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMetadataArtist('artist-1');
  await fetchMetadataReleaseGroup('rg-1');
  await fetchMetadataRelease('release-1');
  await resolveMusicBrainzArtistLocal('mb-artist-1');
  await resolveMusicBrainzReleaseGroupLocal('mb-rg-1');
  await resolveMusicBrainzReleaseLocal('mb-release-1');

  const urls = Array.from({ length: 6 }, (_, i) => globalThis.fetch.mock.calls[i].arguments[0]);
  assert.equal(urls[0], '/api/v1/metadata/artists/artist-1');
  assert.equal(urls[1], '/api/v1/metadata/release-groups/rg-1');
  assert.equal(urls[2], '/api/v1/metadata/releases/release-1');
  assert.equal(urls[3], '/api/v1/metadata/musicbrainz/artists/mb-artist-1/local');
  assert.equal(urls[4], '/api/v1/metadata/musicbrainz/release-groups/mb-rg-1/local');
  assert.equal(urls[5], '/api/v1/metadata/musicbrainz/releases/mb-release-1/local');
});

test('metadata-api fetchMetadataArtistDetectionEvents sends before and limit', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMetadataArtistDetectionEvents('a-1', { before: 'cursor-x', limit: 10 });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('before=cursor-x'));
  assert.ok(url.includes('limit=10'));
});

test('metadata-api search endpoints send query params', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await searchLocalMetadataArtists({ query: 'daft', limit: 5 });
  await searchLocalMetadataReleaseGroups({ query: 'discovery' });
  await searchLocalMetadataReleases({ query: 'homework' });

  const urls = Array.from({ length: 3 }, (_, i) => globalThis.fetch.mock.calls[i].arguments[0]);
  assert.ok(urls[0].includes('q=daft'));
  assert.ok(urls[0].includes('limit=5'));
  assert.ok(urls[1].includes('q=discovery'));
  assert.ok(urls[2].includes('q=homework'));
});

test('metadata-api fetchMonitoredArtists sends limit', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMonitoredArtists({ limit: 25 });

  assert.ok(globalThis.fetch.mock.calls[0].arguments[0].includes('limit=25'));
});

test('metadata-api fetchOperatorMonitoredArtistProjections sends limit', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchOperatorMonitoredArtistProjections({ limit: 50 });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.equal(url, '/api/v1/metadata/artists/monitored/operator?limit=50');
});

test('metadata-api fetchOperatorArtistProjection encodes artist id', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchOperatorArtistProjection('artist/operator');

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.equal(url, '/api/v1/metadata/artists/artist%2Foperator/operator');
});

test('metadata-api searchMusicBrainzArtists sends query params', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await searchMusicBrainzArtists({ query: 'radiohead', limit: 10 });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('q=radiohead'));
  assert.ok(url.includes('limit=10'));
});

test('metadata-api searchMusicBrainzReleases sends artist and release params', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await searchMusicBrainzReleases({ artist: 'daft punk', release: 'discovery' });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('artist=daft'));
  assert.ok(url.includes('release=discovery'));
});

test('metadata-api fetchSimilarArtists encodes artistId', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchSimilarArtists('artist/slash', { limit: 5 });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('artist%2Fslash'));
  assert.ok(url.includes('limit=5'));
});

test('metadata-api browseMusicBrainzArtistReleaseGroups sends all params', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await browseMusicBrainzArtistReleaseGroups({
    artistId: 'a-1',
    limit: 20,
    offset: 40,
    type: 'Album',
    releaseGroupStatus: 'official',
  });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('limit=20'));
  assert.ok(url.includes('offset=40'));
  assert.ok(url.includes('type=Album'));
  assert.ok(url.includes('releaseGroupStatus=official'));
});

test('metadata-api fetchMusicBrainzReleaseGroupReleases sends GET', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMusicBrainzReleaseGroupReleases('rg-1');

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/metadata/musicbrainz/release-groups/rg-1/releases');
});

test('metadata-api import endpoints send POST with CSRF', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-meta' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await importMusicBrainzArtist('mb-a-1');
  await importMusicBrainzReleaseGroup('mb-rg-1');
  await importMusicBrainzRelease('mb-r-1');

  assert.equal(globalThis.fetch.mock.callCount(), 3);
  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/metadata/musicbrainz/artists/mb-a-1/import');
  assert.equal(globalThis.fetch.mock.calls[1].arguments[0], '/api/v1/metadata/musicbrainz/release-groups/mb-rg-1/import');
  assert.equal(globalThis.fetch.mock.calls[2].arguments[0], '/api/v1/metadata/musicbrainz/releases/mb-r-1/import');

  for (let i = 0; i < 3; i++) {
    assert.equal(globalThis.fetch.mock.calls[i].arguments[1].method, 'POST');
    assert.equal(globalThis.fetch.mock.calls[i].arguments[1].headers.get('X-CSRF-Token'), 'csrf-meta');
  }
});

test('metadata-api updateMetadataArtistMonitoring sends PUT with body', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-meta' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await updateMetadataArtistMonitoring('a-1', { isMonitored: true });

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/metadata/artists/a-1/monitoring');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'PUT');

  const body = JSON.parse(globalThis.fetch.mock.calls[0].arguments[1].body);
  assert.equal(body.isMonitored, true);
});

test('metadata-api saveOperatorArtistDraft sends PUT with CSRF and body', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-meta' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await saveOperatorArtistDraft('artist/operator', {
    monitoring: { isMonitored: true },
    releaseGroupSelections: [],
    trackOverrides: [],
  });

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/metadata/artists/artist%2Foperator/operator');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'PUT');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].headers.get('X-CSRF-Token'), 'csrf-meta');

  const body = JSON.parse(globalThis.fetch.mock.calls[0].arguments[1].body);
  assert.deepEqual(body.releaseGroupSelections, []);
  assert.equal(body.monitoring.isMonitored, true);
});

test('metadata-api startMetadataArtistRefresh sends POST', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-meta' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await startMetadataArtistRefresh('a-1');

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/metadata/artists/a-1/refresh');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'POST');
});

test('metadata-api fetchReleaseGroupTracklist sends preferReleaseMbid and preferReleaseId', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchReleaseGroupTracklist('rg-mbid', { preferReleaseMbid: 'r-mbid', preferReleaseId: 'r-id' });

  const url = globalThis.fetch.mock.calls[0].arguments[0];
  assert.ok(url.includes('preferReleaseMbid=r-mbid'));
  assert.ok(url.includes('preferReleaseId=r-id'));
});

test('metadata-api markReleaseCanonical sends PATCH with CSRF', async (t) => {
  globalThis.document = { cookie: 'harmoniarr_csrf=csrf-meta' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await markReleaseCanonical('release-1');

  assert.equal(globalThis.fetch.mock.calls[0].arguments[0], '/api/v1/metadata/releases/release-1/canonical');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].method, 'PATCH');
  assert.equal(globalThis.fetch.mock.calls[0].arguments[1].headers.get('X-CSRF-Token'), 'csrf-meta');
});

test('metadata-api encodes IDs with special characters', async (t) => {
  globalThis.document = { cookie: '' };
  globalThis.fetch = t.mock.fn(async () => createJsonResponse());

  await fetchMetadataArtist('artist/slash');
  assert.ok(globalThis.fetch.mock.calls[0].arguments[0].includes('artist%2Fslash'));
});
