import assert from 'node:assert/strict';
import test from 'node:test';
import { ref } from 'vue';
import { useMetadataDetectionHistory } from '../../src/client/composables/useMetadataDetectionHistory.js';
import { useMetadataHistoryFocus } from '../../src/client/composables/useMetadataHistoryFocus.js';
import { withResolvers } from '../../testing/client/promise-helpers.js';

function history(fetchDetectionEvents) {
  const workflow = useMetadataDetectionHistory({ localArtist: ref({ artist: { id: 'a' }, detectionEvents: [] }), captureWorkspace: () => ({ isCurrent: () => true }), fetchDetectionEvents });
  workflow.reset({ hasMore: true, nextCursor: 'first' });
  return workflow;
}

test('current completion reports progress/count/end and loses currency when its history resets', async () => {
  const page = withResolvers(); const workflow = history(() => page.promise);
  const pending = workflow.loadMoreDetectionEvents();
  assert.equal(workflow.detectionEventsStatusMessage.value, 'Loading more history.');
  page.resolve({ detectionEvents: [{ id: 'one' }, { id: 'two' }], pageInfo: { hasMore: false, nextCursor: null } });
  const result = await pending;
  assert.equal(result.kind, 'loaded'); assert.equal(result.hasMore, false); assert.equal(result.isCurrent(), true);
  assert.equal(workflow.detectionEventsStatusMessage.value, 'Loaded 2 more history entries. All history loaded.');
  workflow.reset(); assert.equal(result.isCurrent(), false); assert.equal(workflow.detectionEventsStatusMessage.value, '');
});

test('empty and single-entry pages describe the returned page and whether another page remains', async () => {
  for (const [entries, hasMore, expected] of [[[], false, 'No additional history entries were returned. All history loaded.'], [[{ id: 'one' }], true, 'Loaded 1 more history entry.']]) {
    const workflow = history(async () => ({ detectionEvents: entries, pageInfo: { hasMore, nextCursor: 'next' } }));
    const result = await workflow.loadMoreDetectionEvents();
    assert.equal(result.hasMore, hasMore); assert.equal(workflow.detectionEventsStatusMessage.value, expected);
  }
});

test('a current failure returns a retry outcome while cancellation clears progress silently', async () => {
  let calls = 0;
  const workflow = history(async () => { throw ++calls === 1 ? new Error('History unavailable') : new DOMException('cancelled', 'AbortError'); });
  const failure = await workflow.loadMoreDetectionEvents();
  assert.equal(failure.kind, 'failed'); assert.equal(workflow.detectionEventsErrorMessage.value, 'History unavailable');
  assert.equal(workflow.detectionEventsStatusMessage.value, ''); assert.equal(workflow.detectionEventsPageInfo.value.nextCursor, 'first');
  const cancelled = await workflow.loadMoreDetectionEvents();
  assert.equal(cancelled.kind, 'cancelled'); assert.equal(failure.isCurrent(), false);
  assert.equal(workflow.detectionEventsErrorMessage.value, ''); assert.equal(workflow.detectionEventsStatusMessage.value, '');
});

test('duplicate and obsolete pages cannot supply completion feedback or clear new progress', async t => {
  const old = withResolvers(); const current = withResolvers(); let calls = 0;
  const workflow = history(() => (++calls === 1 ? old.promise : current.promise));
  const first = workflow.loadMoreDetectionEvents(); assert.equal(await workflow.loadMoreDetectionEvents(), undefined); assert.equal(calls, 1);
  workflow.reset({ hasMore: true, nextCursor: 'new' }); const second = workflow.loadMoreDetectionEvents();
  t.after(async () => { old.resolve({}); current.resolve({}); await Promise.all([first, second]); });
  old.resolve({ detectionEvents: [], pageInfo: { hasMore: false } }); assert.equal(await first, undefined);
  assert.equal(workflow.detectionEventsStatusMessage.value, 'Loading more history.'); assert.equal(workflow.isLoadingMoreDetectionEvents.value, true);
  current.resolve({ detectionEvents: [], pageInfo: { hasMore: false } }); await second;
  assert.equal(workflow.detectionEventsStatusMessage.value, 'No additional history entries were returned. All history loaded.');
});

function surface() {
  const listeners = new Set();
  const document = { body: {}, activeElement: null,
    addEventListener: (_, listener) => listeners.add(listener), removeEventListener: (_, listener) => listeners.delete(listener),
    focus(target) { this.activeElement = target; for (const listener of listeners) listener({ target }); },
  };
  const target = () => { const element = { isConnected: true, disabled: false, focus: options => { element.lastFocusOptions = options; document.focus(element); } }; return element; };
  const button = target(); const heading = target(); document.activeElement = button;
  return { document, button, heading, listeners };
}

test('owned final completion focuses the heading; continuing, failed and cancelled pages restore the button', async () => {
  for (const result of [{ kind: 'loaded', hasMore: false }, { kind: 'loaded', hasMore: true }, { kind: 'failed' }, { kind: 'cancelled' }]) {
    const ui = surface();
    const load = useMetadataHistoryFocus(async () => { ui.document.focus(ui.document.body); return { ...result, isCurrent: () => true }; }, { getDocument: () => ui.document, getCompletionTarget: () => ui.heading });
    await load(); assert.equal(ui.document.activeElement, result.kind === 'loaded' && !result.hasMore ? ui.heading : ui.button);
    assert.equal(ui.document.activeElement.lastFocusOptions.preventScroll, ui.document.activeElement === ui.button);
    assert.equal(ui.listeners.size, 0);
  }
});

test('a user move elsewhere remains respected even if focus later returns to the body', async () => {
  for (const leaveOnBody of [false, true]) {
    const ui = surface(); const other = {};
    const load = useMetadataHistoryFocus(async () => { ui.document.focus(other); if (leaveOnBody) ui.document.focus(ui.document.body); return { kind: 'loaded', hasMore: false, isCurrent: () => true }; }, { getDocument: () => ui.document, getCompletionTarget: () => ui.heading });
    await load(); assert.equal(ui.document.activeElement, leaveOnBody ? ui.document.body : other); assert.equal(ui.listeners.size, 0);
  }
});

test('an expired result after command completion never moves focus', async () => {
  const ui = surface(); let current = true;
  const load = useMetadataHistoryFocus(async () => { ui.document.focus(ui.document.body); queueMicrotask(() => { current = false; }); return { kind: 'loaded', hasMore: false, isCurrent: () => current }; }, { getDocument: () => ui.document, getCompletionTarget: () => ui.heading });
  await load(); assert.equal(ui.document.activeElement, ui.document.body); assert.equal(ui.listeners.size, 0);
});

test('detached or disabled destinations are not focused', async () => {
  for (const state of [{ isConnected: false }, { disabled: true }]) {
    const ui = surface(); Object.assign(ui.heading, state);
    const load = useMetadataHistoryFocus(async () => { ui.document.focus(ui.document.body); return { kind: 'loaded', hasMore: false, isCurrent: () => true }; }, { getDocument: () => ui.document, getCompletionTarget: () => ui.heading });
    await load(); assert.equal(ui.document.activeElement, ui.document.body); assert.equal(ui.listeners.size, 0);
  }
});

test('unexpected Error/null is preserved while focus listeners always retire', async () => {
  for (const failure of [new Error('original'), null]) {
    const ui = surface(); let caught = false;
    const load = useMetadataHistoryFocus(async () => { throw failure; }, { getDocument: () => ui.document, getCompletionTarget: () => ui.heading });
    try { await load(); } catch (error) { caught = true; assert.equal(error, failure); }
    assert.equal(caught, true); assert.equal(ui.listeners.size, 0);
  }
});
