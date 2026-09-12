import assert from 'node:assert/strict';
import test from 'node:test';
import { createMusicBrainzCatalogService } from '../../src/server/metadata/musicbrainz-catalog-service.js';
import { createReleaseGroupTracklistService } from '../../src/server/metadata/release-group-tracklist-service.js';

const groupMbid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const otherGroupMbid = 'ffffffff-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const releaseMbid = (index) => `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const makeRelease = (index) => ({
  id: releaseMbid(index),
  title: `Edition ${index}`,
  'release-group': { id: groupMbid },
  media: [{ 'track-count': 12 }],
});

function createCatalog(t, { payload = makeRelease(26), pageSize = 25, total = 42 } = {}) {
  const lookupRelease = t.mock.fn(async () => payload);
  const browseReleaseGroupReleases = t.mock.fn(async () => ({
    'release-count': total,
    releases: Array.from({ length: pageSize }, (_, index) => makeRelease(index + 1)),
  }));
  return {
    lookupRelease,
    browseReleaseGroupReleases,
    service: createMusicBrainzCatalogService({ musicBrainzClient: { lookupRelease, browseReleaseGroupReleases } }),
  };
}

function createTracklist(t, catalog, localReleases = null) {
  const responses = localReleases === null ? [[]] : [[{ id: 'local-group' }], localReleases];
  const query = t.mock.fn(async () => {
    assert.ok(responses.length > 0, 'An absent local preferred edition must not load a substitute local tracklist');
    return { rows: responses.shift() };
  });
  const importReleaseGroup = t.mock.fn(async () => {});
  return {
    query,
    importReleaseGroup,
    service: createReleaseGroupTracklistService({
      getPoolFn: () => ({ query }),
      musicBrainzCatalogService: catalog.service,
      importMusicBrainzReleaseGroup: importReleaseGroup,
    }),
  };
}

test('edition lookup validates and normalizes identities before using the provider client', async (t) => {
  const catalog = createCatalog(t);
  for (const input of [
    { releaseGroupId: groupMbid, releaseId: '../artist/secret' },
    { releaseGroupId: groupMbid, releaseId: [releaseMbid(26)] },
    { releaseGroupId: `${groupMbid}?inc=secret`, releaseId: releaseMbid(26) },
    { releaseGroupId: null, releaseId: releaseMbid(26) },
  ]) {
    await assert.rejects(() => catalog.service.getReleaseGroupRelease(input), { status: 400, code: 'validation_error' });
  }
  assert.equal(catalog.lookupRelease.mock.callCount(), 0);
  const release = await catalog.service.getReleaseGroupRelease({
    releaseGroupId: groupMbid.toUpperCase(), releaseId: releaseMbid(26).toUpperCase(),
  });
  assert.deepEqual(catalog.lookupRelease.mock.calls[0].arguments, [{ releaseId: releaseMbid(26) }]);
  assert.equal(release.musicbrainzReleaseId, releaseMbid(26));
  assert.equal(release.trackCount, 12);
  assert.equal(release.mediumCount, 1);
  assert.equal(Object.hasOwn(release, 'media'), false, 'The lookup projects a summary, not a raw provider payload');
});

test('edition lookup rejects foreign membership and malformed provider identities', async (t) => {
  for (const [payload, status, code] of [
    [{ ...makeRelease(26), 'release-group': { id: otherGroupMbid } }, 404, 'release_group_mismatch'],
    [makeRelease(27), 502, 'musicbrainz_invalid_response'],
    [{ ...makeRelease(26), 'release-group': null }, 502, 'musicbrainz_invalid_response'],
    [{ ...makeRelease(26), 'release-group': { id: 'not-a-group-id' } }, 502, 'musicbrainz_invalid_response'],
    [{ ...makeRelease(26), title: null }, 502, 'musicbrainz_invalid_response'],
    [null, 502, 'musicbrainz_invalid_response'],
  ]) {
    const catalog = createCatalog(t, { payload });
    await assert.rejects(() => catalog.service.getReleaseGroupRelease({ releaseGroupId: groupMbid, releaseId: releaseMbid(26) }), { status, code });
    assert.equal(catalog.lookupRelease.mock.callCount(), 1);
  }
});

for (const localReleases of [null, [], [{ id: 'canonical-local-edition', musicbrainz_release_id: releaseMbid(1), is_canonical: true }]]) {
  test(`tracklist honors an off-page remote edition with ${localReleases === null ? 'no local group' : localReleases.length === 0 ? 'an empty import' : 'a partial local import'}`, async (t) => {
    const catalog = createCatalog(t);
    const tracklist = createTracklist(t, catalog, localReleases);
    const result = await tracklist.service.getReleaseGroupTracklist({ releaseGroupMbid: groupMbid, preferReleaseMbid: releaseMbid(26) });
    assert.equal(result.source, 'musicbrainz');
    assert.equal(result.release.musicbrainzReleaseId, releaseMbid(26));
    assert.equal(result.release.title, 'Edition 26');
    assert.equal(result.release.id, null);
    assert.equal(result.allReleases.length, 25, 'Direct lookup must not advance the browse page by an extra row');
    assert.equal(result.allReleases.some((release) => release.musicbrainzReleaseId === releaseMbid(26)), false);
    assert.deepEqual(result.editionPage, { releaseGroupId: groupMbid, limit: 25, offset: 0, total: 42 });
    assert.equal(catalog.browseReleaseGroupReleases.mock.callCount(), 1);
    assert.deepEqual(catalog.browseReleaseGroupReleases.mock.calls[0].arguments, [{ releaseGroupId: groupMbid, limit: 25, offset: 0 }]);
    assert.equal(catalog.lookupRelease.mock.callCount(), 1);
    assert.equal(tracklist.importReleaseGroup.mock.callCount(), 1);
  });
}

test('preferred remote lookup works independently of an empty browse page', async (t) => {
  const catalog = createCatalog(t, { pageSize: 0 });
  const tracklist = createTracklist(t, catalog);
  const result = await tracklist.service.getReleaseGroupTracklist({ releaseGroupMbid: groupMbid, preferReleaseMbid: releaseMbid(26) });
  assert.equal(result.release.musicbrainzReleaseId, releaseMbid(26));
  assert.deepEqual(result.allReleases, []);
  assert.equal(result.editionPage.total, 42);
});

test('first-page preference uses browse membership without another provider lookup', async (t) => {
  const catalog = createCatalog(t, { pageSize: 2 });
  const tracklist = createTracklist(t, catalog);
  const result = await tracklist.service.getReleaseGroupTracklist({ releaseGroupMbid: groupMbid, preferReleaseMbid: releaseMbid(2) });
  assert.equal(result.release.musicbrainzReleaseId, releaseMbid(2));
  assert.equal(result.allReleases.length, 2);
  assert.equal(result.editionPage.total, 42, 'A short provider page can still have more editions');
  assert.equal(catalog.lookupRelease.mock.callCount(), 0);
});

test('rejected off-page membership never substitutes a first-page edition or starts import', async (t) => {
  const catalog = createCatalog(t, { payload: { ...makeRelease(26), 'release-group': { id: otherGroupMbid } } });
  const tracklist = createTracklist(t, catalog);
  await assert.rejects(() => tracklist.service.getReleaseGroupTracklist({ releaseGroupMbid: groupMbid, preferReleaseMbid: releaseMbid(26) }), { status: 404 });
  assert.equal(tracklist.importReleaseGroup.mock.callCount(), 0);
});

test('missing or malformed provider totals stay unknown without dropping the first page', async (t) => {
  for (const total of [null, '42', -1, Number.MAX_SAFE_INTEGER + 1]) {
    const catalog = createCatalog(t, { total, pageSize: 2 });
    const tracklist = createTracklist(t, catalog);
    const result = await tracklist.service.getReleaseGroupTracklist({ releaseGroupMbid: groupMbid });
    assert.equal(result.allReleases.length, 2);
    assert.equal(result.editionPage.total, null);
  }
});
