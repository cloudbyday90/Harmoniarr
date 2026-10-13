/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { tryLockedOperatorTrackSourceNoop } from '../../src/server/metadata/operator-track-source-noop-store.js';
import { createOperatorTrackSourceLifecycleService } from '../../src/server/metadata/operator-track-source-lifecycle-service.js';

const source = { ownerId: 'owner', mediaRequestId: 'request', importCandidateId: 'candidate', available: true,
  scope: { version: 1, mode: 'tracks', metadataReleaseId: 'release', tracks: [{ metadataTrackId: 'track' }] } };

test('missing and fabricated authority cannot dispatch a source lock or authorize a skip', async () => {
  const queryable = { query: () => { throw new Error('Unexpected query'); } };
  for (const rootReadAuthority of [undefined, null, {}, { transactionId: '101' }]) {
    assert.equal(await tryLockedOperatorTrackSourceNoop({ source, queryable, rootReadAuthority }), false);
  }
});

test('custom stores stay guarded, capture sources before awaiting and preserve positive-copy deduplication', async () => {
  const input = [structuredClone(source), { ...structuredClone(source), available: false },
    { ...structuredClone(source), mediaRequestId: 'aaa' }];
  const calls = []; let guards = 0;
  const lifecycle = createOperatorTrackSourceLifecycleService({ store: {
    transitionSource: async ({ source: current }) => { calls.push(['transition', structuredClone(current)]); return true; },
    insertEvent: async ({ source: current }) => { calls.push(['event', structuredClone(current)]); },
    tryNoop: () => { throw new Error('Custom no-op must not grant authority'); },
  } });
  await lifecycle.reconcileSources({ sources: input, queryable: {}, rootReadAuthority: {}, assertCurrent: async () => {
    guards++; input[0].scope.metadataReleaseId = 'changed'; input[2].mediaRequestId = 'changed';
  } });
  assert.equal(guards, 3); assert.equal(calls.length, 4);
  assert.deepEqual(calls.filter(([type]) => type === 'transition').map(([, row]) => [row.mediaRequestId, row.available]),
    [['aaa', true], ['request', true]]);
  assert.equal(calls.every(([, row]) => row.scope.metadataReleaseId === 'release'), true);
});

for (const primary of [new Error('original source failure'), null]) test(`required event preserves ${primary === null ? 'null' : 'Error'} and stops later work`, async () => {
  let guards = 0; let transitions = 0;
  const lifecycle = createOperatorTrackSourceLifecycleService({ store: { transitionSource: async () => { transitions++; return true; },
    insertEvent: async () => { throw primary; } } });
  await assert.rejects(lifecycle.reconcileSources({ sources: [source, { ...source, mediaRequestId: 'zzz' }],
    queryable: {}, assertCurrent: async () => { guards++; } }), error => error === primary);
  assert.equal(guards, 1); assert.equal(transitions, 1);
});

test('a standalone default lifecycle keeps pre-transition and final guards', async () => {
  const calls = []; const queryable = { query: async sql => {
    calls.push(sql.startsWith('UPDATE') ? 'update' : 'event'); return { rowCount: 1 };
  } };
  await createOperatorTrackSourceLifecycleService().reconcileSources({ sources: [source], queryable,
    assertCurrent: async () => { calls.push('guard'); } });
  assert.deepEqual(calls, ['guard', 'update', 'event', 'guard']);
});
