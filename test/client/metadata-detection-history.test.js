import assert from 'node:assert/strict';
import test from 'node:test';
import { useMetadataArtistWorkflow } from '../../src/client/composables/useMetadataArtistWorkflow.js';
import { useMetadataReleaseWorkflow } from '../../src/client/composables/useMetadataReleaseWorkflow.js';
import { withResolvers } from '../../testing/client/promise-helpers.js';

function catalog(id, cursor = `${id}-cursor`) {
  return { artist: { id, source: { musicbrainzArtistId: `mb-${id}` } }, aliases: [], releaseGroups: [], releases: [], detectionEvents: [{ id: `${id}-initial` }], detectionEventsPageInfo: { hasMore: true, nextCursor: cursor } };
}

function createWorkflow(options = {}) {
  return useMetadataArtistWorkflow({
    canManageMetadata: () => true,
    fetchArtist: async id => catalog(id),
    browseArtistReleaseGroups: async () => ({ browse: { results: [] } }),
    ...options,
  });
}

test('an obsolete artist page cannot append events or replace the new cursor even when abort is ignored', async t => {
  const page = withResolvers(); const fetchPage = t.mock.fn(() => page.promise);
  const workflow = createWorkflow({ fetchArtistDetectionEvents: fetchPage });
  await workflow.openLocalArtist({ id: 'a' }); const pending = workflow.loadMoreDetectionEvents();
  await workflow.openLocalArtist({ id: 'b' });
  page.resolve({ detectionEvents: [{ id: 'a-old' }], pageInfo: { hasMore: false, nextCursor: 'a-old-cursor' } }); await pending;
  assert.deepEqual(workflow.localArtist.value.detectionEvents, [{ id: 'b-initial' }]);
  assert.deepEqual(workflow.detectionEventsPageInfo.value, { hasMore: true, nextCursor: 'b-cursor' });
  const [artistId, options] = fetchPage.mock.calls[0].arguments;
  assert.equal(artistId, 'a'); assert.equal(options.before, 'a-cursor'); assert.equal(options.signal.aborted, true);
  assert.equal(workflow.isLoadingMoreDetectionEvents.value, false);
});

test('artist A to B to A keeps the new page pending when an old page finishes', async t => {
  const old = withResolvers(); const current = withResolvers(); let calls = 0;
  const workflow = createWorkflow({ fetchArtistDetectionEvents: () => (++calls === 1 ? old.promise : current.promise) });
  await workflow.openLocalArtist({ id: 'a' }); const first = workflow.loadMoreDetectionEvents();
  await workflow.openLocalArtist({ id: 'b' }); await workflow.openLocalArtist({ id: 'a' });
  const second = workflow.loadMoreDetectionEvents();
  t.after(async () => { old.resolve({}); current.resolve({}); await Promise.all([first, second]); });
  old.resolve({ detectionEvents: [{ id: 'old' }], pageInfo: { hasMore: false } }); await first;
  assert.equal(workflow.isLoadingMoreDetectionEvents.value, true); assert.equal(calls, 2);
  assert.deepEqual(workflow.localArtist.value.detectionEvents, [{ id: 'a-initial' }]);
  current.resolve({ detectionEvents: [{ id: 'a-current' }], pageInfo: { hasMore: false, nextCursor: null } }); await second;
  assert.deepEqual(workflow.localArtist.value.detectionEvents, [{ id: 'a-initial' }, { id: 'a-current' }]);
  assert.equal(workflow.isLoadingMoreDetectionEvents.value, false);
});

test('an obsolete page failure cannot replace current artist feedback', async () => {
  const page = withResolvers(); const workflow = createWorkflow({ fetchArtistDetectionEvents: () => page.promise });
  await workflow.openLocalArtist({ id: 'a' }); const pending = workflow.loadMoreDetectionEvents();
  await workflow.openLocalArtist({ id: 'b' }); workflow.detectionEventsErrorMessage.value = 'current feedback';
  page.reject(new Error('old artist failed')); await pending;
  assert.equal(workflow.detectionEventsErrorMessage.value, 'current feedback');
  assert.equal(workflow.detectionEventsPageInfo.value.nextCursor, 'b-cursor');
});

test('current failure retains its cursor, duplicate clicks do not dispatch, and an aborted retry is silent', async () => {
  const page = withResolvers(); let calls = 0;
  const workflow = createWorkflow({ fetchArtistDetectionEvents: () => { calls++; return calls === 1 ? page.promise : Promise.reject(new DOMException('cancelled', 'AbortError')); } });
  await workflow.openLocalArtist({ id: 'a' }); const pending = workflow.loadMoreDetectionEvents();
  await workflow.loadMoreDetectionEvents(); assert.equal(calls, 1);
  page.reject(new Error('page unavailable')); await pending;
  assert.equal(workflow.detectionEventsErrorMessage.value, 'page unavailable');
  assert.equal(workflow.detectionEventsPageInfo.value.nextCursor, 'a-cursor');
  assert.equal(workflow.isLoadingMoreDetectionEvents.value, false);
  await workflow.loadMoreDetectionEvents();
  assert.equal(workflow.detectionEventsErrorMessage.value, ''); assert.equal(workflow.isLoadingMoreDetectionEvents.value, false);
});

test('a catalog replacement retires a pending page even without changing the artist generation', async () => {
  const page = withResolvers();
  const workflow = createWorkflow({
    fetchArtistDetectionEvents: () => page.promise,
    resolveArtistLocal: async () => catalog('a', 'replacement-cursor'),
    createReleaseWorkflow: options => useMetadataReleaseWorkflow({ ...options,
      importReleaseGroupById: async () => {},
      resolveReleaseGroupLocal: async () => ({ releaseGroup: { id: 'group' } }),
      fetchReleaseGroupReleases: async () => ({ releases: { results: [] } }),
    }),
  });
  await workflow.openLocalArtist({ id: 'a' }); const pending = workflow.loadMoreDetectionEvents();
  await workflow.importReleaseGroup({ id: 'group' });
  page.resolve({ detectionEvents: [{ id: 'old-page' }], pageInfo: { hasMore: false } }); await pending;
  assert.deepEqual(workflow.localArtist.value.detectionEvents, [{ id: 'a-initial' }]);
  assert.equal(workflow.detectionEventsPageInfo.value.nextCursor, 'replacement-cursor');
  assert.equal(workflow.isLoadingMoreDetectionEvents.value, false);
});

test('a page returning after artist opening fails cannot publish into a missing workspace', async () => {
  const page = withResolvers();
  const workflow = createWorkflow({ fetchArtistDetectionEvents: () => page.promise, fetchArtist: async id => { if (id === 'b') throw new Error('artist unavailable'); return catalog(id); } });
  await workflow.openLocalArtist({ id: 'a' }); const pending = workflow.loadMoreDetectionEvents();
  await workflow.openLocalArtist({ id: 'b' }); page.resolve({ detectionEvents: [{ id: 'old' }] }); await pending;
  assert.equal(workflow.localArtist.value, null); assert.equal(workflow.detectionEventsErrorMessage.value, '');
  assert.equal(workflow.artistActionError.value, 'artist unavailable'); assert.equal(workflow.isLoadingMoreDetectionEvents.value, false);
});

test('opening another artist seals pagination before its detail response arrives', async t => {
  const artist = withResolvers(); const fetchPage = t.mock.fn(async () => ({}));
  const workflow = createWorkflow({ fetchArtistDetectionEvents: fetchPage, fetchArtist: id => id === 'b' ? artist.promise : Promise.resolve(catalog(id)) });
  await workflow.openLocalArtist({ id: 'a' }); const opening = workflow.openLocalArtist({ id: 'b' });
  t.after(async () => { artist.resolve(catalog('b')); await opening; });
  await workflow.loadMoreDetectionEvents(); assert.equal(fetchPage.mock.callCount(), 0);
  artist.resolve(catalog('b')); await opening;
  assert.equal(workflow.detectionEventsPageInfo.value.nextCursor, 'b-cursor');
});
