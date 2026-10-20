import assert from 'node:assert/strict';
import test from 'node:test';
import { createSlskdSearchResponseService } from '../../src/server/import-candidates/slskd-search-response-service.js';

const searchId = 'owned-search';
const empty = { searchId, responses: [] };
const published = { searchId, responses: [{ username: 'peer', files: [{ filename: 'Release\\01 Track.flac' }] }] };
const completed = { id: searchId, state: 'Completed, TimedOut', isComplete: true, responseCount: 0, fileCount: 0, lockedFileCount: 0,
  endedAt: '2026-10-20T12:00:00.000Z', responses: [] };

function createFixture(t, states, responses = [empty]) {
  let stateIndex = 0;
  let responseIndex = 0;
  const slskdService = {
    getSearchState: t.mock.fn(async () => states[Math.min(stateIndex++, states.length - 1)]),
    getSearchResponses: t.mock.fn(async () => responses[Math.min(responseIndex++, responses.length - 1)]),
  };
  const sleepFn = t.mock.fn(async () => {});
  const service = createSlskdSearchResponseService({ slskdService, sleepFn, pollAttempts: 2, publicationPollAttempts: 2, pollIntervalMs: 1 });
  return { service, slskdService, sleepFn };
}

test('available bodies return immediately without state polling or sleeping', async (t) => {
  const fixture = createFixture(t, [], [published]);
  assert.equal(await fixture.service.waitForSearchResponses({ searchId }), published);
  assert.equal(fixture.slskdService.getSearchState.mock.callCount(), 0);
  assert.equal(fixture.sleepFn.mock.callCount(), 0);
});

test('a completed count update at the search budget boundary gets a separate publication allowance', async (t) => {
  const fixture = createFixture(t, [
    { id: searchId, isComplete: false },
    { ...completed, responseCount: 1, endedAt: null },
    { ...completed, responseCount: 1 },
    { ...completed, responseCount: 1, responses: published.responses },
  ]);
  assert.deepEqual(await fixture.service.waitForSearchResponses({ searchId }), published);
  assert.equal(fixture.slskdService.getSearchState.mock.callCount(), 4);
  assert.equal(fixture.sleepFn.mock.callCount(), 4);
});

test('response endpoint publication after a completed snapshot is accepted', async (t) => {
  const fixture = createFixture(t, [{ ...completed, responseCount: 1, endedAt: null }], [empty, empty, published]);
  assert.equal(await fixture.service.waitForSearchResponses({ searchId }), published);
  assert.equal(fixture.slskdService.getSearchState.mock.callCount(), 2);
});

test('a finalized zero-result search returns promptly after confirming the response endpoint', async (t) => {
  const fixture = createFixture(t, [completed]);
  assert.equal(await fixture.service.waitForSearchResponses({ searchId }), empty);
  assert.equal(fixture.slskdService.getSearchState.mock.callCount(), 1);
  assert.equal(fixture.slskdService.getSearchResponses.mock.callCount(), 2);
});

test('zero counts before finalization keep waiting until the final empty publication', async (t) => {
  const fixture = createFixture(t, [{ ...completed, endedAt: null }, completed]);
  assert.equal(await fixture.service.waitForSearchResponses({ searchId }), empty);
  assert.equal(fixture.slskdService.getSearchState.mock.callCount(), 2);
});

for (const [label, state] of [
  ['positive response count', { ...completed, responseCount: 1 }],
  ['positive file count', { ...completed, fileCount: 1 }],
  ['positive locked file count', { ...completed, lockedFileCount: 1 }],
  ['missing finalization', { ...completed, endedAt: null }],
  ['invalid finalization', { ...completed, endedAt: 'unknown' }],
  ['unverified counters', { ...completed, responseCount: '0' }],
]) {
  test(`completed search with ${label} cannot publish a false empty result or reset its allowance`, async (t) => {
    const fixture = createFixture(t, [state]);
    await assert.rejects(fixture.service.waitForSearchResponses({ searchId }), { status: 503, code: 'slskd_search_responses_not_ready' });
    assert.equal(fixture.slskdService.getSearchState.mock.callCount(), 3);
    assert.equal(fixture.slskdService.getSearchResponses.mock.callCount(), 4);
  });
}

test('an earlier positive count prevents later regressing snapshots from granting a zero result', async (t) => {
  const fixture = createFixture(t, [{ ...completed, isComplete: false, responseCount: 1 }, completed]);
  await assert.rejects(fixture.service.waitForSearchResponses({ searchId }), { code: 'slskd_search_responses_not_ready' });
  assert.equal(fixture.slskdService.getSearchState.mock.callCount(), 4);
});

for (const state of ['Completed, Cancelled', 'Completed, Errored']) {
  test(`a finalized ${state} search refuses a zero-result success`, async (t) => {
    const fixture = createFixture(t, [{ ...completed, state }]);
    await assert.rejects(fixture.service.waitForSearchResponses({ searchId }), { code: 'slskd_search_failed' });
    assert.equal(fixture.slskdService.getSearchState.mock.callCount(), 1);
  });
}

test('queued and running observations share a fixed budget and never become a successful no-match', async (t) => {
  const fixture = createFixture(t, [{ id: searchId, state: 'Requested', isComplete: false }, { id: searchId, state: 'InProgress', isComplete: false }]);
  await assert.rejects(fixture.service.waitForSearchResponses({ searchId }), { code: 'slskd_search_responses_not_ready' });
  assert.equal(fixture.slskdService.getSearchState.mock.callCount(), 2);
  assert.equal(fixture.slskdService.getSearchResponses.mock.callCount(), 1);
});

test('an empty response without a state reader cannot establish finalization', async () => {
  const service = createSlskdSearchResponseService({ slskdService: { getSearchResponses: async () => empty } });
  await assert.rejects(service.waitForSearchResponses({ searchId }), { code: 'slskd_search_responses_not_ready' });
});

for (const failure of [new Error('state read failed'), null]) {
  test(`state read failure preserves ${failure === null ? 'null' : 'the original Error'} and stops polling`, async (t) => {
    const fixture = createFixture(t, []);
    fixture.slskdService.getSearchState.mock.mockImplementation(async () => { throw failure; });
    let caught = false;
    try { await fixture.service.waitForSearchResponses({ searchId }); }
    catch (error) { caught = true; assert.equal(error, failure); }
    assert.equal(caught, true);
    assert.equal(fixture.slskdService.getSearchState.mock.callCount(), 1);
    assert.equal(fixture.slskdService.getSearchResponses.mock.callCount(), 1);
  });
}

test('cancellation after a held provider read refuses even a newly available body', async (t) => {
  const fixture = createFixture(t, []);
  let release;
  let entered;
  const held = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { entered = resolve; });
  fixture.slskdService.getSearchResponses.mock.mockImplementation(async () => { entered(); await held; return published; });
  const cancellation = Object.assign(new Error('Cancelled'), { code: 'operation_run_cancelled' });
  let cancelled = false;
  const waiting = fixture.service.waitForSearchResponses({ searchId, assertCurrent: async () => { if (cancelled) throw cancellation; } });
  await started;
  cancelled = true;
  release();
  await assert.rejects(waiting, error => error === cancellation);
  assert.equal(fixture.slskdService.getSearchState.mock.callCount(), 0);
});

test('trusted polling configuration rejects unbounded or invalid work', () => {
  for (const options of [{ pollAttempts: Infinity }, { pollAttempts: 61 }, { publicationPollAttempts: 11 }, { pollIntervalMs: -1 }]) {
    assert.throws(() => createSlskdSearchResponseService(options), TypeError);
  }
});
