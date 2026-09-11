import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryExternalRequestCollectionIntakeService } from '../../src/server/library/library-external-request-collection-intake-service.js';
import { buildCollectionWorkKey } from '../../src/server/library/provider-collection-cursor-policy.js';

function fixture(t) {
  const row = { id: 'page', mediaRequestId: 'request', sourceProvider: 'youtube', sourceIdentifier: 'playlist',
    ingestTargetType: 'playlist_page', pageNumber: 1, pageCursor: null, status: 'planned' };
  row.ingestKey = buildCollectionWorkKey(row);
  const state = { collection: { mediaRequestId: 'request', requestedForUserId: 'target', status: 'preparing', pagesCompleted: 0 },
    request: { requestKind: 'external_url', requestState: 'needs_fetch', requestedForUser: { id: 'target' } },
    user: { id: 'target' }, rows: [row], items: [], failed: null };
  const queryable = { query: async () => {} };
  const collectionStore = {
    getCollection: t.mock.fn(async () => state.collection),
    lockRequest: t.mock.fn(async () => {}),
    listWork: t.mock.fn(async () => state.rows),
    getWork: t.mock.fn(async ({ id }) => state.rows.find((item) => item.id === id)),
    getWorkByKey: t.mock.fn(async () => null),
    insertWork: t.mock.fn(async ({ row: work }) => ({ ...work, id: 'child' })),
    listItemKeys: t.mock.fn(async () => state.items.map((item) => item.itemKey)),
    insertItem: t.mock.fn(async ({ item }) => { state.items.push(item); }),
    completeWork: t.mock.fn(async () => {}),
    advanceCollection: t.mock.fn(async () => state.collection),
    failWork: t.mock.fn(async (args) => { state.failed = args; }),
    hasOtherPreparation: t.mock.fn(async () => false),
    hasDecisions: t.mock.fn(async () => false),
    hasApprovedIntents: t.mock.fn(async () => false),
    initialize: t.mock.fn(async () => state.collection),
  };
  const dependencies = {
    collectionStore,
    mediaRequestStore: { getMediaRequestById: t.mock.fn(async () => state.request) },
    getAppUserById: t.mock.fn(async () => state.user),
    withTransaction: t.mock.fn(async (work) => work(queryable)),
    assertMaintenanceWriteAllowed: t.mock.fn(async () => {}),
    isCancellationRequested: t.mock.fn(async () => false),
    recordAuditEventFn: t.mock.fn(async () => {}),
    resolveProviderClients: t.mock.fn(async () => ({ youtube: {
      listPlaylistItems: t.mock.fn(async () => ({ items: [{ snippet: { title: 'Video', resourceId: { videoId: 'video' } } }] })),
    } })),
  };
  return { collectionStore, dependencies, queryable, state, service: createLibraryExternalRequestCollectionIntakeService(dependencies) };
}
const execute = (value) => value.service.executeCollection({ mediaRequestId: 'request', operationRunId: 'run' });

test('collection page publication rechecks cancellation, maintenance, target, and eligibility on the transaction client', async (t) => {
  const value = fixture(t);
  value.collectionStore.lockRequest.mock.mockImplementation(async () => {
    assert.equal(value.dependencies.assertMaintenanceWriteAllowed.mock.calls.at(-1).arguments[0].queryable, value.queryable);
  });
  const result = await execute(value);
  assert.equal(result.executedCount, 1);
  assert.deepEqual(value.dependencies.isCancellationRequested.mock.calls.at(-1).arguments[0], { runId: 'run', queryable: value.queryable });
  assert.deepEqual(value.dependencies.assertMaintenanceWriteAllowed.mock.calls.at(-1).arguments[0], { queryable: value.queryable });
  assert.deepEqual(value.dependencies.getAppUserById.mock.calls.at(-1).arguments[0], { userId: 'target', queryable: value.queryable });
  assert.equal(value.collectionStore.listWork.mock.calls[0].arguments[0].limit, 10);
  assert.equal(value.collectionStore.advanceCollection.mock.calls[0].arguments[0].itemsSeen, 1);
});

for (const mutation of ['cancelled', 'retargeted', 'disabled', 'ineligible', 'maintenance', 'run_cancelled']) {
  test(`collection page fetched before ${mutation} cannot publish evidence or child work`, async (t) => {
    const value = fixture(t);
    value.dependencies.resolveProviderClients.mock.mockImplementation(async () => ({ youtube: { listPlaylistItems: async () => {
      if (mutation === 'cancelled') value.state.request.requestState = 'cancelled';
      if (mutation === 'retargeted') value.state.request.requestedForUser.id = 'other';
      if (mutation === 'disabled') value.state.user.isDisabled = true;
      if (mutation === 'ineligible') value.state.user.plexProfile = { accessPolicy: { requestTargetingEligible: false } };
      if (mutation === 'maintenance') value.dependencies.isCancellationRequested.mock.mockImplementation(async () => ({ kind: 'paused' }));
      if (mutation === 'run_cancelled') value.dependencies.isCancellationRequested.mock.mockImplementation(async () => true);
      return { items: [] };
    } } }));
    await assert.rejects(execute(value), { code: mutation === 'maintenance' ? 'operation_run_paused' : 'operation_run_cancelled' });
    assert.equal(value.collectionStore.completeWork.mock.callCount(), 0);
    assert.equal(value.collectionStore.insertWork.mock.callCount(), 0);
    assert.equal(value.collectionStore.failWork.mock.callCount(), 0);
  });
}

test('the container page budget prevents an additional provider call', async (t) => {
  const value = fixture(t);
  value.state.collection.pagesCompleted = 50;
  const provider = t.mock.fn(async () => assert.fail('Exhausted collection must not fetch'));
  value.dependencies.resolveProviderClients.mock.mockImplementation(async () => ({ youtube: { listPlaylistItems: provider } }));
  const result = await execute(value);
  assert.equal(result.failedCount, 1);
  assert.equal(provider.mock.callCount(), 0);
  assert.equal(value.state.failed.blockedReason, 'provider_collection_page_limit');
});

test('a retarget while acquiring the page transaction lock prevents the atomic publication', async (t) => {
  const value = fixture(t);
  value.collectionStore.lockRequest.mock.mockImplementation(async () => { value.state.request.requestedForUser.id = 'replacement'; });
  await assert.rejects(execute(value), { code: 'operation_run_cancelled' });
  assert.equal(value.collectionStore.completeWork.mock.callCount(), 0);
  assert.equal(value.collectionStore.insertItem.mock.callCount(), 0);
});

test('unavailable album metadata remains an explicit unsupported decision with the original leaf identity', async (t) => {
  const value = fixture(t);
  const work = { ...value.state.rows[0], sourceProvider: 'spotify', sourceIdentifier: 'album', ingestTargetType: 'release' };
  work.ingestKey = buildCollectionWorkKey(work);
  value.state.rows = [work];
  value.dependencies.resolveProviderClients.mock.mockImplementation(async () => ({ spotify: { getAlbum: async () => {
    throw Object.assign(new Error('Album unavailable'), { code: 'spotify_not_found' });
  } } }));
  const result = await execute(value);
  assert.equal(result.executedCount, 1);
  assert.equal(value.state.items[0].itemKey, 'spotify:release:album');
  assert.equal(value.state.items[0].itemKind, 'unsupported');
  assert.equal(value.collectionStore.failWork.mock.callCount(), 0);
});

test('manual initialization uses the supplied transaction for all checks, ledger writes, and audit', async (t) => {
  const value = fixture(t);
  value.state.collection = null;
  const source = { provider: 'youtube', resourceType: 'playlist', sourceIdentifier: 'playlist', canonicalUrl: 'https://www.youtube.com/playlist?list=playlist' };
  await value.service.initializeCollection({ mediaRequestId: 'request', normalizedSource: source, queryable: value.queryable });
  assert.equal(value.dependencies.withTransaction.mock.callCount(), 0);
  assert.equal(value.collectionStore.initialize.mock.calls[0].arguments[0].queryable, value.queryable);
  assert.equal(value.dependencies.recordAuditEventFn.mock.calls[0].arguments[1], value.queryable);
});

test('normal planning resumes an existing collection without replacing completed evidence', async (t) => {
  const value = fixture(t);
  const result = await value.service.initializeCollection({ mediaRequestId: 'request', normalizedSource: {
    provider: 'youtube', resourceType: 'playlist', sourceIdentifier: 'playlist',
  } });
  assert.equal(result.collection, value.state.collection);
  assert.equal(value.collectionStore.initialize.mock.callCount(), 0);
  assert.equal(value.collectionStore.insertWork.mock.callCount(), 0);
});

test('a blocked collection with review decisions cannot discard its evidence through restart', async (t) => {
  const value = fixture(t);
  value.state.collection.status = 'blocked';
  value.collectionStore.hasDecisions.mock.mockImplementation(async () => true);
  await assert.rejects(value.service.initializeCollection({ mediaRequestId: 'request', restart: true, normalizedSource: {
    provider: 'youtube', resourceType: 'playlist', sourceIdentifier: 'playlist',
  } }), { code: 'external_collection_restart_unavailable' });
  assert.equal(value.collectionStore.initialize.mock.callCount(), 0);
});

test('automatic initialization cannot replace legacy provider evidence after albums were approved', async (t) => {
  const value = fixture(t);
  value.state.collection = null;
  value.collectionStore.hasApprovedIntents.mock.mockImplementation(async () => true);
  await assert.rejects(value.service.initializeCollection({ mediaRequestId: 'request', operationRunId: 'planning-run', normalizedSource: {
    provider: 'youtube', resourceType: 'playlist', sourceIdentifier: 'playlist',
  } }), { code: 'external_collection_legacy_approvals' });
  assert.equal(value.collectionStore.initialize.mock.callCount(), 0);
  assert.equal(value.collectionStore.insertWork.mock.callCount(), 0);
});
