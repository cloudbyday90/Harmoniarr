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
import { useArtistDetail } from '../../src/client/composables/useArtistDetail.js';
import { useLocalArtistDiscographyPages } from '../../src/client/composables/useLocalArtistDiscographyPages.js';
import { createOperatorArtistDetailDraft, buildOperatorArtistSaveDraft } from '../../src/client/lib/operator-artist-detail-draft.js';

const group = (id, artistId = 'artist') => ({ id, artistId, title: id, primaryType: 'Album' });
const page = (rows, cursor = null) => ({ releaseGroups: rows, pageInfo: { hasMore: cursor !== null, nextCursor: cursor } });
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };
const operator = () => ({ monitoring: { isMonitored: true }, overview: { releaseGroupCount: 28 },
  releaseGroupSelections: [{ metadataReleaseGroupId: 'off-page', selectionState: 'unselected' }],
  trackOverrides: [{ metadataReleaseGroupId: 'off-page', trackMbid: 'saved-track', isDesired: true }],
  coverage: { acquiredReleaseCount: 4 }, reconciliation: { latestSnapshot: { snapshotRevision: 3 } } });

test('local append preserves projection identity, complete draft intent, and saved revision', async () => {
  const detail = useArtistDetail({ resolveLocal: async () => ({ artist: { id: 'artist' } }),
    fetchOperatorProjection: async (_id, options) => {
      assert.equal(options.view, 'summary'); return { artist: { id: 'artist' }, operator: operator() };
    },
    fetchLocalPage: async (_id, options) => options.cursor ? page([group('second')]) : page([group('first')], 'next'),
    browseReleaseGroups: () => assert.fail('Summary must not be mistaken for an empty remote catalog'),
    fetchSimilar: async () => ({ similarArtists: [] }) });
  await detail.loadArtistDetail('mbid');
  const projection = detail.projection.value;
  const draft = createOperatorArtistDetailDraft(projection);
  draft.releaseGroupSelections.push({ metadataReleaseGroupId: 'first', selectionState: 'partial' });
  const savedIntent = buildOperatorArtistSaveDraft(draft);
  await detail.loadMoreDiscography();
  assert.equal(detail.projection.value, projection);
  assert.deepEqual(buildOperatorArtistSaveDraft(draft), savedIntent);
  assert.equal(projection.operator.reconciliation.latestSnapshot.snapshotRevision, 3);
  assert.equal(projection.operator.coverage.acquiredReleaseCount, 4);
  assert.deepEqual(detail.releaseGroups.value.map(({ id }) => id), ['first', 'second']);
});

test('a successful full save response invalidates pending pages and retains summary globals', async () => {
  const pending = deferred();
  let firstReads = 0;
  const detail = useArtistDetail({ resolveLocal: async () => ({ artist: { id: 'artist' } }),
    fetchOperatorProjection: async () => ({ artist: { id: 'artist' }, operator: operator() }),
    fetchLocalPage: async (_id, options) => options.cursor ? pending.promise
      : page([group(++firstReads === 1 ? 'before' : 'saved')], firstReads === 1 ? 'next' : null),
    fetchSimilar: async () => ({ similarArtists: [] }) });
  await detail.loadArtistDetail('mbid');
  const append = detail.loadMoreDiscography();
  detail.setOperatorProjection({ artist: { id: 'artist' }, operator: operator(),
    releaseGroups: Array.from({ length: 100 }, (_, index) => group(`full-${index}`)), releases: [] });
  await Promise.resolve();
  pending.resolve(page([group('late')]));
  await append;
  assert.deepEqual(detail.releaseGroups.value.map(({ id }) => id), ['saved']);
  assert.equal(detail.projection.value.releaseGroups, undefined);
  assert.equal(detail.projection.value.releases, undefined);
  assert.equal(detail.operator.value.trackOverrides[0].trackMbid, 'saved-track');
});

test('local first-page failure is retryable and later failure retains rows and cursor', async () => {
  const reads = [];
  let fails = true;
  const pages = useLocalArtistDiscographyPages({ fetchPage: async (_id, { cursor }) => {
    reads.push(cursor);
    if (fails) throw new Error('private provider error');
    return cursor ? page([group('second')]) : page([group('first')], 'next');
  } });
  assert.equal(await pages.start('artist'), false);
  assert.equal(pages.pagination.value.hasMore, true);
  assert.doesNotMatch(pages.error.value, /private/);
  fails = false;
  await pages.loadMore();
  fails = true;
  await pages.loadMore();
  assert.deepEqual(pages.results.value.map(({ id }) => id), ['first']);
  fails = false;
  await pages.loadMore();
  assert.deepEqual(reads, [undefined, undefined, 'next', 'next']);
  assert.equal(pages.pagination.value.hasMore, false);
});

test('navigation and disposal suppress late local pages even when transport ignores abort', async () => {
  const pending = deferred();
  const scope = effectScope();
  const pages = scope.run(() => useLocalArtistDiscographyPages({ fetchPage: async (id) => id === 'old'
    ? pending.promise : page([group('new-group', id)]) }));
  const old = pages.start('old');
  await pages.start('new');
  pending.resolve(page([group('old-group', 'old')]));
  await old;
  assert.equal(pages.results.value[0].artistId, 'new');
  scope.stop();
  assert.equal(await pages.start('new'), false);
  assert.deepEqual(pages.results.value, []);
});

test('malformed, cross-artist, overlapping, and cyclic local pages never publish partial rows', async () => {
  for (const invalid of [page([group('wrong', 'other')]), page([group('first')]),
    page([group('second')], 'next'), page([], 'different'), page(Array.from({ length: 26 }, (_, i) => group(String(i))))]) {
    let calls = 0;
    const pages = useLocalArtistDiscographyPages({ fetchPage: async () => ++calls === 1 ? page([group('first')], 'next') : invalid });
    await pages.start('artist');
    assert.equal(await pages.loadMore(), false);
    assert.deepEqual(pages.results.value.map(({ id }) => id), ['first']);
    assert.equal(pages.pagination.value.hasMore, true);
  }
});
