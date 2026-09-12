/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope } from 'vue';
import { useArtistDiscographyPages } from '../../src/client/composables/useArtistDiscographyPages.js';

const row = (id) => ({ id: String(id), title: `Release ${id}` });
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

test('remote catalog reaches beyond 100 with five explicit bounded page reads', async () => {
  const calls = [];
  const pages = useArtistDiscographyPages({ browseReleaseGroups: async (options) => {
    calls.push(options);
    return { browse: { results: Array.from({ length: Math.min(25, 111 - options.offset) },
      (_, index) => row(options.offset + index)), total: 111, offset: options.offset, cache: { state: 'hit' } } };
  } });
  await pages.start('artist');
  assert.equal(calls.length, 1);
  for (let index = 0; index < 4; index += 1) await pages.loadMore();
  assert.deepEqual(calls.map(({ offset, limit }) => [offset, limit]), [[0, 25], [25, 25], [50, 25], [75, 25], [100, 25]]);
  assert.deepEqual(pages.pagination.value, { loaded: 111, total: 111, hasMore: false, complete: true });
  assert.deepEqual(pages.cache.value, { state: 'hit' });
  assert.equal(await pages.loadMore(), false);
  assert.equal(calls.length, 5);
});

test('duplicate identities preserve first rows and advance by raw length, including short pages with known totals', async () => {
  const offsets = [];
  const pages = useArtistDiscographyPages({ limit: 3, browseReleaseGroups: async ({ offset }) => {
    offsets.push(offset);
    return offset === 0 ? { results: [row('a'), row('a')], total: 4 }
      : { results: [row('a'), row('b')], total: 4 };
  } });
  await pages.start('artist');
  assert.equal(pages.pagination.value.hasMore, true);
  await pages.loadMore();
  assert.deepEqual(offsets, [0, 2]);
  assert.deepEqual(pages.results.value.map(({ id }) => id), ['a', 'b']);
  assert.equal(pages.pagination.value.complete, false);
  assert.equal(pages.pagination.value.hasMore, false);
  assert.match(pages.error.value, /changed while loading/u);
});

test('load-more failure retains successful data and cache, retries same offset and rejects duplicate activation', async () => {
  const next = deferred();
  const calls = [];
  const pages = useArtistDiscographyPages({ limit: 1, browseReleaseGroups: ({ offset }) => {
    calls.push(offset);
    if (offset === 0) return { results: [row('first')], total: 2, cache: { hit: true } };
    if (calls.length === 2) return next.promise;
    return { results: [row('last')], total: 2 };
  } });
  await pages.start('artist');
  const loading = pages.loadMore();
  assert.equal(pages.isLoadingMore.value, true);
  assert.equal(await pages.loadMore(), false);
  next.reject(new Error('private provider diagnostics'));
  assert.equal(await loading, false);
  assert.equal(pages.isLoadingMore.value, false);
  assert.match(pages.error.value, /try again/u);
  assert.doesNotMatch(pages.error.value, /private/u);
  assert.deepEqual(pages.results.value.map(({ id }) => id), ['first']);
  assert.deepEqual(pages.cache.value, { hit: true });
  await pages.loadMore();
  assert.deepEqual(calls, [0, 1, 1]);
  assert.equal(pages.error.value, null);
  assert.equal(pages.pagination.value.complete, true);
});

test('known incomplete empty page is retryable without falsely marking complete', async () => {
  let calls = 0;
  const pages = useArtistDiscographyPages({ limit: 1, browseReleaseGroups: async () => {
    calls += 1;
    return { results: calls === 2 ? [] : [row(calls)], total: 2 };
  } });
  await pages.start('artist');
  await pages.loadMore();
  assert.deepEqual(pages.pagination.value, { loaded: 1, total: 2, hasMore: true, complete: false });
  assert.match(pages.error.value, /stopped/u);
  await pages.loadMore();
  assert.equal(pages.pagination.value.complete, true);
});

test('mismatched response offset does not merge or advance and remains retryable', async () => {
  const offsets = [];
  const pages = useArtistDiscographyPages({ limit: 1, browseReleaseGroups: async ({ offset }) => {
    offsets.push(offset);
    return { results: [row(offsets.length)], total: 2, offset: offsets.length === 2 ? 9 : offset };
  } });
  await pages.start('artist');
  assert.equal(await pages.loadMore(), false);
  assert.equal(pages.results.value.length, 1);
  await pages.loadMore();
  assert.deepEqual(offsets, [0, 1, 1]);
  assert.equal(pages.results.value.length, 2);
});

test('unknown totals allow a full page then stop on short page without claiming completeness', async () => {
  const pages = useArtistDiscographyPages({ limit: 1,
    browseReleaseGroups: async ({ offset }) => ({ results: offset === 0 ? [row('one')] : [] }) });
  await pages.start('artist');
  assert.deepEqual(pages.pagination.value, { loaded: 1, total: null, hasMore: true, complete: false });
  await pages.loadMore();
  assert.deepEqual(pages.pagination.value, { loaded: 1, total: null, hasMore: false, complete: false });
  assert.equal(pages.error.value, null);
});

test('first-page errors propagate to the artist loader and a new start can recover', async () => {
  let fail = true;
  const failure = new Error('first failure');
  const pages = useArtistDiscographyPages({ browseReleaseGroups: async () => {
    if (fail) throw failure;
    return { results: [], total: 0 };
  } });
  await assert.rejects(pages.start('artist'), failure);
  assert.equal(pages.pagination.value.hasMore, false);
  fail = false;
  await pages.start('artist');
  assert.equal(pages.pagination.value.complete, true);
  assert.equal(pages.error.value, null);
});

for (const outcome of ['response', 'failure']) {
  test(`new artist ignores obsolete ${outcome} even when transport ignores abort`, async () => {
    const old = deferred();
    let oldSignal;
    const pages = useArtistDiscographyPages({ browseReleaseGroups: ({ artistId, signal }) => {
      if (artistId === 'old') { oldSignal = signal; return old.promise; }
      return { results: [row('new')], total: 1 };
    } });
    const pending = pages.start('old');
    await pages.start('new');
    assert.equal(oldSignal.aborted, true);
    if (outcome === 'response') old.resolve({ results: [row('old')], total: 1 });
    else old.reject(new Error('obsolete'));
    assert.equal(await pending, false);
    assert.deepEqual(pages.results.value.map(({ id }) => id), ['new']);
    assert.equal(pages.error.value, null);
  });
}

test('reset aborts pending later page and stale completion cannot repopulate cleared catalog', async () => {
  const next = deferred();
  let signal;
  const pages = useArtistDiscographyPages({ limit: 1, browseReleaseGroups: (options) => {
    signal = options.signal;
    return options.offset === 0 ? { results: [row('first')], total: 2 } : next.promise;
  } });
  await pages.start('artist');
  const pending = pages.loadMore();
  pages.reset();
  assert.equal(signal.aborted, true);
  next.resolve({ results: [row('late')], total: 2 });
  assert.equal(await pending, false);
  assert.equal(pages.results.value.length, 0);
  assert.equal(pages.isLoadingMore.value, false);
});

test('external abort forwards cancellation and view ownership predicate suppresses stale results', async () => {
  for (const mode of ['abort', 'ownership']) {
    const response = deferred();
    const controller = new AbortController();
    let current = true;
    let signal;
    const pages = useArtistDiscographyPages({ browseReleaseGroups: (options) => {
      signal = options.signal;
      return response.promise;
    } });
    const pending = pages.start('artist', { signal: controller.signal, isCurrent: () => current });
    if (mode === 'abort') { controller.abort(); assert.equal(signal.aborted, true); }
    else current = false;
    response.resolve({ results: [row('late')], total: 1 });
    assert.equal(await pending, false);
    assert.equal(pages.results.value.length, 0);
  }
});

test('scope disposal prevents delayed callers from restarting requests', async () => {
  const scope = effectScope();
  let calls = 0;
  const pages = scope.run(() => useArtistDiscographyPages({ browseReleaseGroups: async () => {
    calls += 1;
    return { results: [row('one')], total: 1 };
  } }));
  await pages.start('artist');
  scope.stop();
  assert.equal(await pages.start('later'), false);
  assert.equal(await pages.loadMore(), false);
  assert.equal(calls, 1);
  assert.equal(pages.results.value.length, 0);
});

test('page-size configuration rejects values outside the route contract without coercion', () => {
  for (const limit of [0, -1, 26, 100, '25', 1.5, NaN, null]) {
    assert.throws(() => useArtistDiscographyPages({ limit }), RangeError);
  }
});

test('oversized response is rejected before merging and preserves retry offset', async () => {
  const offsets = [];
  const pages = useArtistDiscographyPages({ limit: 1, browseReleaseGroups: async ({ offset }) => {
    offsets.push(offset);
    return { results: offsets.length === 2 ? [row('extra'), row('extra2')] : [row(offset)], total: 2 };
  } });
  await pages.start('artist');
  assert.equal(await pages.loadMore(), false);
  assert.deepEqual(pages.results.value.map(({ id }) => id), ['0']);
  await pages.loadMore();
  assert.deepEqual(offsets, [0, 1, 1]);
});
