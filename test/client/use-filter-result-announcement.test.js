/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope, nextTick, ref } from 'vue';
import { useFilterResultAnnouncement } from '../../src/client/composables/useFilterResultAnnouncement.js';

function createAnnouncement(t, isReady = false) {
  const scope = effectScope();
  t.after(() => scope.stop());
  const ready = ref(isReady);
  const failed = ref(false);
  const resultLabel = ref('Showing 0 of 0 transfers.');
  const contextKey = ref('/app/downloader');
  const command = scope.run(() => useFilterResultAnnouncement({ ready, failed, resultLabel, contextKey }));
  return { ...command, ready, failed, resultLabel, contextKey, scope };
}

async function flushFeedback() { await nextTick(); await nextTick(); await nextTick(); }

test('defers an early user filter until actual data and render readiness', async (t) => {
  const state = createAnnouncement(t);
  state.requestAnnouncement();
  await flushFeedback();
  assert.equal(state.announcement.value, '');
  state.resultLabel.value = 'Showing 2 of 4 transfers.';
  state.ready.value = true;
  await flushFeedback();
  assert.equal(state.announcement.value, state.resultLabel.value);
});

test('latest choice supersedes an announcement already waiting for its next tick', async (t) => {
  const state = createAnnouncement(t, true);
  state.resultLabel.value = 'Showing 2 of 4 transfers.';
  state.requestAnnouncement();
  await nextTick();
  state.resultLabel.value = 'Showing 0 of 4 transfers.';
  state.requestAnnouncement();
  assert.equal(state.announcement.value, '');
  await flushFeedback();
  assert.equal(state.announcement.value, 'Showing 0 of 4 transfers.');
});

test('background data changes and revalidation do not repeat consumed feedback', async (t) => {
  const state = createAnnouncement(t, true);
  state.resultLabel.value = 'Showing 2 of 4 transfers.';
  state.requestAnnouncement(); await flushFeedback();
  state.resultLabel.value = 'Showing 1 of 3 transfers.';
  state.ready.value = false; await nextTick(); state.ready.value = true;
  await flushFeedback();
  assert.equal(state.announcement.value, 'Showing 2 of 4 transfers.');
  state.requestAnnouncement(); await flushFeedback();
  assert.equal(state.announcement.value, 'Showing 1 of 3 transfers.');
});

test('failure cancels the request even when retry starts before the next flush', async (t) => {
  const state = createAnnouncement(t);
  state.requestAnnouncement(); state.failed.value = true;
  state.failed.value = false; state.ready.value = true;
  state.resultLabel.value = 'Showing 3 of 4 transfers.';
  await flushFeedback(); assert.equal(state.announcement.value, '');
  state.requestAnnouncement(); await flushFeedback();
  assert.equal(state.announcement.value, 'Showing 3 of 4 transfers.');
});

test('route context change cancels pending and clears previously scoped feedback', async (t) => {
  const state = createAnnouncement(t, true);
  state.requestAnnouncement(); await flushFeedback();
  state.requestAnnouncement(); state.contextKey.value = '/app/downloader?decision=another';
  await flushFeedback(); assert.equal(state.announcement.value, '');
});

test('scope disposal prevents late publication and refuses retained callers', async (t) => {
  const state = createAnnouncement(t, true);
  state.requestAnnouncement(); await nextTick(); state.scope.stop();
  await flushFeedback(); assert.equal(state.announcement.value, '');
  state.requestAnnouncement(); await flushFeedback(); assert.equal(state.announcement.value, '');
});

test('an identical explicit result is cleared and published again', async (t) => {
  const state = createAnnouncement(t, true);
  state.requestAnnouncement(); await flushFeedback();
  state.requestAnnouncement(); assert.equal(state.announcement.value, '');
  await flushFeedback(); assert.equal(state.announcement.value, state.resultLabel.value);
});
