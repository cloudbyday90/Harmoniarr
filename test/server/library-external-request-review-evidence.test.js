/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExternalRequestPreparationState, projectExternalRequestReviewItem } from '../../src/server/library/library-external-request-review-evidence.js';

const spotify = {
  id: 'item', sourceProvider: 'spotify', sourceIdentifier: 'album',
  sourceResourceType: 'release', ingestTargetType: 'release', status: 'completed',
  evidence: { fetchedAt: '2026-09-10T12:00:00Z', response: {
    id: 'album', name: 'Prepared album', artists: [{ name: 'Artist' }], total_tracks: 9,
    release_date: '2026', access_token: 'secret', tracks: { next: 'private provider URL' },
  } },
};

test('review exposes bounded display evidence and preserves unknown provider date precision', () => {
  const item = projectExternalRequestReviewItem(spotify);
  assert.equal(item.reviewable, true);
  assert.equal(item.releaseDate, '2026');
  assert.equal(item.trackCount, 9);
  assert.equal(item.providerKey, 'spotify:release:album');
  assert.doesNotMatch(JSON.stringify(item), /secret|private provider URL|access_token/);
});

test('Apple album envelope supplies evidence without inventing missing fields', () => {
  const item = projectExternalRequestReviewItem({
    ...spotify, sourceProvider: 'apple_music',
    evidence: { response: { data: [{ id: 'album', attributes: { name: 'Localized album', artistName: 'Artist' } }] } },
  });
  assert.equal(item.reviewable, true);
  assert.equal(item.title, 'Localized album');
  assert.equal(item.releaseDate, null);
  assert.equal(item.trackCount, null);
});

for (const [description, row] of [
  ['unfinished album', { ...spotify, status: 'planned' }],
  ['container', { ...spotify, ingestTargetType: 'playlist_page' }],
  ['track', { ...spotify, ingestTargetType: 'track', sourceResourceType: 'track' }],
  ['video', { ...spotify, sourceProvider: 'youtube', ingestTargetType: 'video' }],
  ['mismatched provider identity', { ...spotify, sourceIdentifier: 'different' }],
  ['missing artist', { ...spotify, evidence: { response: { id: 'album', name: 'Album' } } }],
  ['malformed provider artists', { ...spotify, evidence: { response: { id: 'album', name: 'Album', artists: {} } } }],
]) {
  test(`${description} cannot silently become an approved release`, () => {
    assert.equal(projectExternalRequestReviewItem(row).reviewable, false);
  });
}

test('recovery offers only missing planning or unfinished items and suppresses active work', () => {
  assert.deepEqual(buildExternalRequestPreparationState({ items: [], activeRun: null }), { canRecover: true, action: 'plan' });
  assert.deepEqual(buildExternalRequestPreparationState({ items: [spotify], activeRun: null }), { canRecover: false, action: null });
  assert.deepEqual(buildExternalRequestPreparationState({ items: [{ status: 'failed' }], activeRun: null }), { canRecover: true, action: 'execute' });
  assert.deepEqual(buildExternalRequestPreparationState({ items: [{ status: 'planned' }], activeRun: { id: 'active' } }), { canRecover: false, action: null });
});
