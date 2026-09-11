import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryExternalRequestDiscoveryService } from '../../src/server/library/library-external-request-discovery-service.js';

function createFixture(t) {
  const state = {
    intent: { id: 'intent-a', mediaRequestId: 'request-a', metadataReleaseId: 'release', requestedForUserId: 'target-a', artistName: 'Artist', releaseTitle: 'Release', releaseGroupId: 'group' },
    request: { id: 'request-a', requestKind: 'external_url', requestState: 'needs_fetch', requestedForUser: { id: 'target-a' }, requestedByUser: { id: 'admin' } },
    target: { id: 'target-a', isDisabled: false },
  };
  const transaction = { query: async () => {} };
  let nextSearch = 0;
  const dependencies = {
    assertMaintenanceWriteAllowed: t.mock.fn(async () => {}),
    getAppUserById: t.mock.fn(async () => state.target),
    getReleaseTracklistExpectationsFn: t.mock.fn(async () => ({ expectedTrackCount: 4 })),
    importCandidateService: {
      ingestSlskdSearchResponses: t.mock.fn(async (args) => {
        await args.beforePersistCandidates({ queryable: transaction });
        return { candidateCount: 1, fileCount: 4, sourceSearchId: args.searchId };
      }),
    },
    isCancellationRequested: t.mock.fn(async () => false),
    mediaRequestStore: { getMediaRequestById: t.mock.fn(async () => state.request) },
    reviewStore: {
      getIntentById: t.mock.fn(async () => state.intent),
      lockRequest: t.mock.fn(async () => {}),
    },
    slskdService: { startSearch: t.mock.fn(async () => ({ id: `search-${++nextSearch}` })) },
  };
  return { dependencies, state, transaction, service: createLibraryExternalRequestDiscoveryService(dependencies) };
}

function discover(fixture) {
  return fixture.service.discoverExternalRequestRelease({ intentId: fixture.state.intent.id, mediaRequestId: fixture.state.request.id, operationRunId: 'run', triggeredByUserId: 'admin' });
}

test('approved external release creates pending candidates using the original request and its target', async (t) => {
  const fixture = createFixture(t);
  const result = await discover(fixture);
  assert.deepEqual(result, { candidateCount: 1, fileCount: 4, intentId: 'intent-a', mediaRequestId: 'request-a', metadataReleaseId: 'release', searchId: 'search-1' });
  const args = fixture.dependencies.importCandidateService.ingestSlskdSearchResponses.mock.calls[0].arguments[0];
  assert.equal(args.expectedTrackCount, 4);
  assert.deepEqual(args.requestOwnership, {
    externalRequestReleaseIntentId: 'intent-a', metadataReleaseGroupId: 'group', metadataReleaseId: 'release', sourceMediaRequestId: 'request-a', sourceRequestKind: 'external_url', sourceRequestedByUserId: 'admin', sourceRequestedForUserId: 'target-a', sourceType: 'media_request',
  });
  assert.deepEqual(fixture.dependencies.reviewStore.lockRequest.mock.calls[0].arguments[0], { mediaRequestId: 'request-a', queryable: fixture.transaction });
  assert.deepEqual(fixture.dependencies.getAppUserById.mock.calls.at(-1).arguments[0], { userId: 'target-a', queryable: fixture.transaction });
  assert.deepEqual(fixture.dependencies.isCancellationRequested.mock.calls.at(-1).arguments[0], { runId: 'run', queryable: fixture.transaction });
});

test('two targets approving one release receive distinct searches and independent candidate ownership', async (t) => {
  const fixture = createFixture(t);
  const first = await discover(fixture);
  fixture.state.intent = { ...fixture.state.intent, id: 'intent-b', mediaRequestId: 'request-b', requestedForUserId: 'target-b' };
  fixture.state.request = { ...fixture.state.request, id: 'request-b', requestedForUser: { id: 'target-b' } };
  fixture.state.target = { id: 'target-b' };
  const second = await discover(fixture);
  assert.notEqual(first.searchId, second.searchId);
  assert.equal(first.metadataReleaseId, second.metadataReleaseId);
  assert.deepEqual(fixture.dependencies.importCandidateService.ingestSlskdSearchResponses.mock.calls.map((call) => call.arguments[0].requestOwnership.sourceRequestedForUserId), ['target-a', 'target-b']);
});

for (const scenario of ['cancelled', 'retargeted', 'disabled', 'plex_ineligible', 'missing_target']) {
  test(`external discovery refuses a ${scenario} target before contacting the search provider`, async (t) => {
    const fixture = createFixture(t);
    if (scenario === 'cancelled') fixture.state.request.requestState = 'cancelled';
    if (scenario === 'retargeted') fixture.state.request.requestedForUser.id = 'different';
    if (scenario === 'disabled') fixture.state.target.isDisabled = true;
    if (scenario === 'plex_ineligible') fixture.state.target.plexProfile = { accessPolicy: { requestTargetingEligible: false } };
    if (scenario === 'missing_target') fixture.state.target = null;
    await assert.rejects(discover(fixture), { code: 'operation_run_cancelled' });
    assert.equal(fixture.dependencies.slskdService.startSearch.mock.callCount(), 0);
  });
}

test('discovery rejects an intent from a different request', async (t) => {
  const fixture = createFixture(t);
  fixture.state.intent.mediaRequestId = 'other-request';
  await assert.rejects(discover(fixture), { code: 'external_request_intent_not_found' });
  assert.equal(fixture.dependencies.slskdService.startSearch.mock.callCount(), 0);
});

test('cancellation during search prevents response ingestion', async (t) => {
  const fixture = createFixture(t);
  fixture.dependencies.slskdService.startSearch.mock.mockImplementation(async () => {
    fixture.state.request.requestState = 'cancelled';
    return { id: 'search' };
  });
  await assert.rejects(discover(fixture), { code: 'operation_run_cancelled' });
  assert.equal(fixture.dependencies.importCandidateService.ingestSlskdSearchResponses.mock.callCount(), 0);
});

test('cancellation while responses are fetched is rechecked under the candidate transaction lock', async (t) => {
  const fixture = createFixture(t);
  fixture.dependencies.importCandidateService.ingestSlskdSearchResponses.mock.mockImplementation(async ({ beforePersistCandidates }) => {
    fixture.state.request.requestState = 'cancelled';
    await beforePersistCandidates({ queryable: fixture.transaction });
    assert.fail('Cancelled request must not persist candidates');
  });
  await assert.rejects(discover(fixture), { code: 'operation_run_cancelled' });
  assert.equal(fixture.dependencies.reviewStore.lockRequest.mock.callCount(), 1);
});

test('operation pause prevents provider search even while the request remains active', async (t) => {
  const fixture = createFixture(t);
  fixture.dependencies.isCancellationRequested.mock.mockImplementation(async () => ({ kind: 'paused', pauseCode: 'recovery_lock_conflict' }));
  await assert.rejects(discover(fixture), { code: 'operation_run_paused' });
  assert.equal(fixture.dependencies.slskdService.startSearch.mock.callCount(), 0);
});

test('missing approved release metadata stops discovery instead of issuing a broad search', async (t) => {
  const fixture = createFixture(t);
  fixture.state.intent.releaseTitle = '';
  await assert.rejects(discover(fixture), { code: 'external_request_release_metadata_missing' });
  assert.equal(fixture.dependencies.slskdService.startSearch.mock.callCount(), 0);
});
