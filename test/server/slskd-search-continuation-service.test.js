import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { createSlskdSearchContinuationService } from '../../src/server/slskd/slskd-search-continuation-service.js';
import { createSlskdService } from '../../src/server/slskd/slskd-service.js';
import { slskdSearchIntentFingerprint, slskdSearchProviderFingerprint } from '../../src/server/slskd/slskd-search-binding-policy.js';

function fixture(t) {
  const rows = new Map(); const provider = new Map(); const events = [];
  const state = { binding: 'a'.repeat(64), now: new Date('2026-10-20T12:00:00Z'), cancelled: false };
  const options = {
    slskdService: {
      getSearchBinding: async () => state.binding,
      startSearch: t.mock.fn(async ({ id, query }) => {
        events.push('post'); assert.ok([...rows.values()].some(row => row.id === id));
        const search = { id, query }; provider.set(id, search); return search;
      }),
      getSearchState: t.mock.fn(async ({ searchId }) => {
        if (!provider.has(searchId)) throw Object.assign(new Error('Provider record absent'), { details: { status: 404 } });
        return provider.get(searchId);
      }),
    },
    store: {
      reserve: async ({ owner, intentFingerprint, providerFingerprint, searchId, expiresAt }) => {
        const key = JSON.stringify(owner) + intentFingerprint;
        if (rows.has(key)) return { row: rows.get(key), created: false };
        const row = { id: searchId, provider_fingerprint: providerFingerprint, expires_at: expiresAt };
        rows.set(key, row); events.push('reserve'); return { row, created: true };
      },
      markAccepted: t.mock.fn(async () => { events.push('accepted'); }),
    },
    withTransaction: async work => { const result = await work({}); events.push('commit'); return result; },
    getNow: () => state.now,
  };
  const input = { owner: { discoveryRequestId: randomUUID() }, query: 'Artist Album', context: { quality: 'flac', scope: null },
    assertCurrent: async () => { if (state.cancelled) throw Object.assign(new Error('Cancelled'), { code: 'operation_run_cancelled' }); } };
  const create = () => createSlskdSearchContinuationService(options);
  return { options, input, create, rows, provider, events, state };
}

test('a restarted service continues the same committed UUID without another POST', async (t) => {
  const f = fixture(t);
  const first = await f.create().getOrStartSearch(f.input);
  const next = await f.create().getOrStartSearch(f.input);
  assert.equal(first.id, next.id); assert.equal(first.resumed, false); assert.equal(next.resumed, true);
  assert.deepEqual(f.events.slice(0, 3), ['reserve', 'commit', 'post']);
  assert.equal(f.options.slskdService.startSearch.mock.callCount(), 1);
  assert.equal(f.options.slskdService.getSearchState.mock.callCount(), 1);
});

for (const failure of [new Error('Response lost'), null]) {
  test(`uncertain accepted POST preserves ${failure === null ? 'null' : 'Error'} and resumes by reading its reserved UUID`, async (t) => {
    const f = fixture(t);
    f.options.slskdService.startSearch.mock.mockImplementation(async ({ id, query }) => { f.provider.set(id, { id, query }); throw failure; });
    let caught = false;
    try { await f.create().getOrStartSearch(f.input); } catch (error) { caught = true; assert.equal(error, failure); }
    assert.equal(caught, true);
    assert.equal((await f.create().getOrStartSearch(f.input)).resumed, true);
    assert.equal(f.options.slskdService.startSearch.mock.callCount(), 1);
  });
}

test('a reservation with no provider record refuses continuation and never resubmits', async (t) => {
  const f = fixture(t);
  f.options.slskdService.startSearch.mock.mockImplementation(async () => { throw new Error('Before dispatch'); });
  await assert.rejects(f.create().getOrStartSearch(f.input));
  await assert.rejects(f.create().getOrStartSearch(f.input));
  assert.equal(f.options.slskdService.startSearch.mock.callCount(), 1);
  assert.equal(f.rows.size, 1);
});

for (const change of ['provider', 'expiry']) {
  test(`${change} drift refuses an existing intent before another provider call`, async (t) => {
    const f = fixture(t); await f.create().getOrStartSearch(f.input);
    if (change === 'provider') f.state.binding = 'b'.repeat(64);
    else f.state.now = new Date(f.state.now.getTime() + 30 * 60 * 1000);
    await assert.rejects(f.create().getOrStartSearch(f.input), { code: change === 'provider' ? 'slskd_search_provider_changed' : 'slskd_search_continuation_expired' });
    assert.equal(f.options.slskdService.getSearchState.mock.callCount(), 0);
    assert.equal(f.options.slskdService.startSearch.mock.callCount(), 1);
  });
}

test('owner, saved scope and explicit intent generation each keep independent search identities', async (t) => {
  const f = fixture(t); const ids = [];
  for (const input of [f.input, { ...f.input, owner: { discoveryRequestId: randomUUID() } },
    { ...f.input, context: { quality: 'flac', scope: ['track'] } }, { ...f.input, context: { ...f.input.context, generation: 'new-intent' } }]) {
    ids.push((await f.create().getOrStartSearch(input)).id);
  }
  assert.equal(new Set(ids).size, 4);
});

for (const field of ['id', 'query']) {
  test(`provider ${field} mismatch cannot mark acceptance`, async (t) => {
    const f = fixture(t);
    f.options.slskdService.startSearch.mock.mockImplementation(async input => ({ id: input.id, query: input.query, [field]: 'wrong' }));
    await assert.rejects(f.create().getOrStartSearch(f.input), { code: 'slskd_search_identity_invalid' });
    assert.equal(f.options.store.markAccepted.mock.callCount(), 0);
  });
}

test('cancelled authority prevents reservation and POST', async (t) => {
  const f = fixture(t); f.state.cancelled = true;
  await assert.rejects(f.create().getOrStartSearch(f.input), { code: 'operation_run_cancelled' });
  assert.equal(f.rows.size, 0); assert.equal(f.options.slskdService.startSearch.mock.callCount(), 0);
});

test('cancellation after accepted POST retains the reservation without publishing acceptance', async (t) => {
  const f = fixture(t);
  f.options.slskdService.startSearch.mock.mockImplementation(async ({ id, query }) => { f.state.cancelled = true; return { id, query }; });
  await assert.rejects(f.create().getOrStartSearch(f.input), { code: 'operation_run_cancelled' });
  assert.equal(f.rows.size, 1); assert.equal(f.options.store.markAccepted.mock.callCount(), 0);
});

test('canonical intent fingerprints preserve null/array distinctions and ignore object key order', () => {
  const hash = context => slskdSearchIntentFingerprint({ query: 'Artist Album', context });
  assert.equal(hash({ b: 1, a: null }), hash({ a: null, b: 1 }));
  assert.notEqual(hash({ a: null }), hash({ a: [] })); assert.notEqual(hash({}), hash({ a: null }));
  assert.throws(() => hash({ value: Infinity }), TypeError);
});

test('bound provider transport forwards the UUID and refuses configuration drift around HTTP', async (t) => {
  let config = { baseUrl: 'http://127.0.0.1:5030', apiKey: 'first-owned-key' };
  const id = randomUUID();
  const startSearch = t.mock.fn(async input => { config = { ...config, apiKey: 'changed-owned-key' }; return { id: input.id, searchText: input.query }; });
  const service = createSlskdService({ getClientConfig: async () => config, slskdClient: { startSearch } });
  const searchBinding = await service.getSearchBinding();
  assert.equal(searchBinding, slskdSearchProviderFingerprint(config));
  await assert.rejects(service.startSearch({ id, query: 'Artist Album', searchBinding }), { code: 'slskd_search_provider_changed' });
  assert.equal(startSearch.mock.calls[0].arguments[0].id, id);
  await assert.rejects(service.startSearch({ id, query: 'Artist Album', searchBinding }), { code: 'slskd_search_provider_changed' });
  assert.equal(startSearch.mock.callCount(), 1);
  assert.equal(searchBinding.includes('owned-key'), false);
});
