/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCollectionPreparationProgressPresentation } from '../../src/client/lib/collection-preparation-progress-presentation.js';

const collection = { status: 'preparing', revision: 4, targetMatches: true };
function progress(overrides = {}) {
  return {
    revision: 4, work: { total: 4, completed: 1, pending: 2, failed: 1, processing: 0, unsupported: 0 },
    operations: { queued: 0, running: 1 },
    pages: { completed: 1, pending: 1, failed: 0, total: null, traversalComplete: false },
    entriesSeen: 3, leavesCaptured: 2, ...overrides,
  };
}

test('running batches do not become running HTTP requests or a completion percentage', () => {
  const result = buildCollectionPreparationProgressPresentation({ collection, progress: progress() });
  assert.equal(result.label, '1 preparation batch running');
  assert.equal(result.workSummary, '4 captured metadata tasks · 1 completed · 2 pending · 1 failed');
  assert.equal(result.pagesSummary, '1 provider page captured · total pages unknown');
  assert.equal(result.sourceSummary, '3 source entries seen · 2 collection items captured');
  assert.ok(!/%|downloaded|acquired|HTTP/.test(JSON.stringify(result)));
});

test('exhausted pages remain distinct from unfinished album preparation and from reviewed selection import', () => {
  const pages = { completed: 2, pending: 0, failed: 0, total: 2, traversalComplete: true };
  const result = buildCollectionPreparationProgressPresentation({ collection, progress: progress({ pages }) });
  assert.equal(result.pagesSummary, '2 provider pages captured · page traversal complete');
  assert.match(result.detail, /Album metadata may still need preparation/);
  const prepared = buildCollectionPreparationProgressPresentation({ collection: { ...collection, status: 'ready' }, progress: progress({ pages }) });
  assert.equal(prepared.label, 'Metadata preparation complete');
  assert.match(prepared.detail, /Downloads and imports are tracked separately/);
  assert.equal(prepared.operationsSummary, '');
});

test('blocked, reassigned and stale snapshots cannot advertise active preparation', () => {
  const blocked = buildCollectionPreparationProgressPresentation({ collection: { ...collection, status: 'blocked' }, progress: progress() });
  assert.equal(blocked.label, 'Metadata preparation blocked');
  assert.equal(blocked.operationsSummary, '');
  for (const changed of [{ targetMatches: false }, { revision: 5 }, { status: 'cancelled' }]) {
    assert.equal(buildCollectionPreparationProgressPresentation({ collection: { ...collection, ...changed }, progress: progress() }), null);
  }
  assert.equal(buildCollectionPreparationProgressPresentation({ collection, progress: null }), null);
});

test('queued and recorded processing counts retain their distinct meanings', () => {
  const result = buildCollectionPreparationProgressPresentation({ collection, progress: progress({
    operations: { queued: 2, running: 0 }, work: { total: 4, completed: 1, pending: 0, failed: 1, processing: 1, unsupported: 1 },
  }) });
  assert.equal(result.label, '2 preparation batches queued');
  assert.equal(result.otherWorkSummary, '1 task recorded as processing · 1 unsupported task');
});
