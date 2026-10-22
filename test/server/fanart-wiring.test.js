import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import test from 'node:test';
import { selectAlbumImages, selectArtistImages } from '../../src/server/integrations/fanart-tv/fanart-client.js';
import { createArtworkModule } from '../../src/server/artwork/artwork-module.js';
import { albumId, otherAlbumId, cover, createFanartWiringFixture } from '../../testing/server/fanart-wiring-fixture.js';

const expected = [{ imageType: 'albumcover', url: cover.url, id: cover.id, likes: 7 }];
const foreign = { ...cover, id: 'foreign', url: 'https://assets.fanart.tv/foreign.jpg', likes: '999' };
const nested = () => ({ mbid_id: otherAlbumId, albums: [
  { release_group_id: otherAlbumId, albumcover: [foreign] },
  { release_group_id: albumId, albumcover: [cover] },
] });

test('Fanart.tv nested albums bind artwork to the requested release group in both supported formats', () => {
  const response = nested(); const original = structuredClone(response);
  assert.deepEqual(selectAlbumImages(response, albumId), expected);
  assert.deepEqual(response, original);
  assert.deepEqual(selectAlbumImages({ albums: { [otherAlbumId]: { albumcover: [foreign] }, [albumId]: { albumcover: [cover] } } }, albumId), expected);
  assert.deepEqual(selectAlbumImages({ release_group_id: albumId, albumcover: [cover] }, albumId), expected);
});

test('Fanart.tv refuses missing, conflicting, duplicate and malformed album identity without flat fallback', () => {
  for (const albums of [null, false, 'private', [null], [{}], [{ release_group_id: otherAlbumId, albumcover: [foreign] }],
    [{ release_group_id: albumId }, { release_group_id: albumId }], { [otherAlbumId]: { albumcover: [foreign] } },
    { [albumId]: null }, { [albumId]: { release_group_id: otherAlbumId } }]) {
    assert.throws(() => selectAlbumImages({ albums, albumcover: [cover] }, albumId), error => {
      assert.equal(error.code, 'fanarttv_invalid_response'); assert.equal(error.diagnosticCode, 'response_invalid');
      assert.equal(inspect(error).includes('private'), false); return true;
    });
  }
  assert.throws(() => selectAlbumImages({ release_group_id: otherAlbumId, albumcover: [foreign] }, albumId));
  assert.throws(() => selectAlbumImages(nested()));
});

test('Fanart.tv retains empty and flat compatibility results and neutral-language preference safely', () => {
  for (const response of [{}, { albums: [] }, { albums: {} }, { albums: [{ release_group_id: albumId }] }]) {
    assert.deepEqual(selectAlbumImages(response, albumId), []);
  }
  const response = { albumcover: [null, {}, 42, { ...foreign, lang: 'en' }, cover, { ...cover, url: '' }] };
  assert.deepEqual(selectAlbumImages(response, albumId), expected);
  assert.deepEqual(selectArtistImages({ artistthumb: response.albumcover }), [{ ...expected[0], imageType: 'artistthumb' }]);
});

test('artwork composition reads saved Fanart.tv keys afresh and preserves environment fallback after clearing', async () => {
  const requests = [];
  const fixture = createFanartWiringFixture({ env: { FANARTTV_API_KEY: ' env-project ', FANARTTV_CLIENT_KEY: ' env-personal ' },
    fetchImpl: async (url, options) => { requests.push({ url: String(url), headers: options.headers }); return Response.json(nested()); } });
  const call = () => fixture.client.fetchAlbumImages({ mbid: albumId });
  assert.deepEqual(await call(), expected);
  assert.deepEqual(await fixture.mutateKeys({ fanartTvApiKey: ' saved-project ', fanartTvClientKey: ' saved-personal ' }), {});
  assert.deepEqual(await call(), expected);
  await fixture.mutateKeys({ fanartTvApiKey: 'rotated-project', fanartTvClientKey: 'rotated-personal' }); await call();
  await fixture.mutateKeys({ clearFanartTvApiKey: true, clearFanartTvClientKey: true }); await call();
  assert.deepEqual(requests.map(({ headers }) => [headers['api-key'], headers['client-key']]), [
    ['env-project', 'env-personal'], ['saved-project', 'saved-personal'], ['rotated-project', 'rotated-personal'], ['env-project', 'env-personal'],
  ]);
  assert.ok(requests.every(({ url }) => url === `https://webservice.fanart.tv/v3.2/music/albums/${albumId}`));
});

test('saved credential failure dispatches nothing and target mismatch publishes no artwork', async () => {
  let requests = 0; let response = nested();
  const fixture = createFanartWiringFixture({ fetchImpl: async () => { requests++; return Response.json(response); } });
  response.albums.pop();
  await assert.rejects(fixture.resolveAlbum(), { code: 'fanarttv_invalid_response' });
  assert.deepEqual([fixture.downloads.length, fixture.ingestions.length, fixture.assignments.length], [0, 0, 0]);
  response = nested();
  assert.equal((await fixture.resolveAlbum()).assetId, 'fixture-asset');
  assert.deepEqual(fixture.downloads, [cover.url]);
  assert.equal(fixture.ingestions[0].sourceUrl, cover.url);
  assert.equal(fixture.assignments[0].ownerId, albumId);
  assert.equal(fixture.assignments[0].sourceReference, albumId);
  fixture.failCredentials();
  await assert.rejects(fixture.resolveAlbum(), error => {
    assert.equal(error.diagnosticCode, 'credentials_unavailable');
    assert.equal(inspect(error).includes('fixture-private'), false); return true;
  });
  assert.equal(requests, 2); assert.equal(fixture.assignments.length, 1);
});

test('explicit artwork Fanart.tv client overrides bypass the default factory', () => {
  createArtworkModule({ fanartTvClient: {}, createFanartTvClient: () => assert.fail('Override must remain authoritative') });
});
