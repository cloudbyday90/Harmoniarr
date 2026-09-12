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
import { useReleaseEditionPages } from '../../src/client/composables/useReleaseEditionPages.js';
import { useReleaseDetail } from '../../src/client/composables/useReleaseDetail.js';

const group = '00000000-0000-4000-8000-000000000001';
const edition = (n) => ({ musicbrainzReleaseId: `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`, title: `Edition ${n}` });
const page = (offset, rows, total = 60) => ({ releaseGroupId: group, limit: 25, offset, total, results: rows });
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

test('edition pages advance by raw short page size and retain local identity across duplicate rows', async () => {
  const offsets = [];
  const pager = useReleaseEditionPages({ fetchEditions: async (_group, options) => {
    offsets.push(options.offset);
    return { releases: page(options.offset, [edition(2), edition(3)], 4) };
  } });
  pager.accept(group, [{ ...edition(1), id: 'local-one' }, edition(2)], page(0, [], 4));
  await pager.loadMore();
  assert.deepEqual(offsets, [2]);
  assert.equal(pager.results.value.length, 3);
  assert.equal(pager.results.value[0].id, 'local-one');
  assert.equal(pager.hasMore.value, false);
});

test('local editions allow explicit remote browse without automatically requesting or changing selection', async () => {
  let calls = 0;
  const pager = useReleaseEditionPages({ fetchEditions: async (_group, options) => {
    calls += 1;
    assert.equal(options.offset, 0);
    return { releases: page(0, [edition(1), edition(2)], 2) };
  } });
  pager.accept(group, [{ ...edition(1), id: 'local-one' }]);
  assert.equal(calls, 0);
  await pager.loadMore();
  assert.equal(pager.results.value.length, 2);
  assert.equal(pager.results.value[0].id, 'local-one');
});

for (const invalid of [
  { releaseGroupId: 'another-group' }, { offset: 99 }, { total: -1 }, { total: null },
  { results: [null] }, { results: [edition(2), { musicbrainzReleaseId: 'bad' }] },
  { results: [] }, { results: Array.from({ length: 26 }, (_, n) => edition(n)) },
]) {
  test(`invalid edition continuation preserves rows and retry offset: ${JSON.stringify(invalid)}`, async () => {
    const offsets = [];
    let broken = true;
    const pager = useReleaseEditionPages({ fetchEditions: async (_group, options) => {
      offsets.push(options.offset);
      return { releases: broken ? { ...page(1, [edition(2)]), ...invalid } : page(1, [edition(2)], 2) };
    } });
    pager.accept(group, [edition(1)], page(0, [], 2));
    assert.equal(await pager.loadMore(), false);
    assert.deepEqual(pager.results.value, [edition(1)]);
    assert.match(pager.error.value, /try again/);
    broken = false;
    assert.equal(await pager.loadMore(), true);
    assert.deepEqual(offsets, [1, 1]);
    assert.equal(pager.hasMore.value, false);
  });
}

test('duplicate activations, pause, reset and disposal cannot publish stale edition pages', async () => {
  const pending = deferred();
  let signal;
  let calls = 0;
  const scope = effectScope();
  const pager = scope.run(() => useReleaseEditionPages({ fetchEditions: async (_group, options) => {
    calls += 1;
    signal = options.signal;
    return pending.promise;
  } }));
  pager.accept(group, [edition(1)]);
  const work = pager.loadMore();
  assert.equal(await pager.loadMore(), false);
  assert.equal(calls, 1);
  pager.pause();
  assert.equal(signal.aborted, true);
  assert.equal(pager.results.value.length, 1);
  scope.stop();
  pager.accept(group, [edition(3)]);
  pager.merge([edition(4)]);
  assert.equal(await pager.loadMore(), false);
  pending.resolve({ releases: page(0, [edition(2)], 1) });
  await work;
  assert.equal(pager.results.value.length, 0);
  assert.equal(pager.loading.value, false);
});

test('preview preserves appended inventory across remote to local source changes and resets on close', async () => {
  let selected = edition(1);
  let source = 'musicbrainz';
  const detail = useReleaseDetail({
    fetchTracklist: async () => ({ release: selected, allReleases: [edition(1)], source, editionPage: source === 'musicbrainz' ? page(0, [], 2) : undefined }),
    fetchEditions: async () => ({ releases: page(1, [edition(2)], 2) }),
  });
  await detail.load(group);
  await detail.loadMoreEditions();
  selected = { ...edition(2), id: 'now-local' };
  source = 'local';
  await detail.load(group, { preferReleaseMbid: selected.musicbrainzReleaseId });
  assert.equal(detail.allReleases.value.length, 2);
  assert.equal(detail.release.value.id, 'now-local');
  assert.equal(detail.allReleases.value[1].id, 'now-local');
  assert.equal(detail.canLoadMoreEditions.value, false);
  detail.cancel();
  assert.equal(detail.allReleases.value.length, 0);
});
