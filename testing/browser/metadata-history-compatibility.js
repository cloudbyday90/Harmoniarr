/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import { createMetadataCommandFixture, metadataCommandIds } from './metadata-command-fixture.js';
import { bootstrapAdminThroughUi } from './operator-browser-helpers.js';
import { historyEvent, historyPage } from './metadata-history-data.js';

export { historyEvent, historyPage };

export function createHistoryCompatibilityFixture() {
  const entries = []; let reads = []; let readPage;
  const fixture = createMetadataCommandFixture({ history: { entries, pageInfo: { hasMore: true, nextCursor: 'initial-cursor' },
    readPage: args => { reads.push(args); return readPage(args); },
  } });
  return {
    createAppFn: fixture.createAppFn,
    get reads() { return reads; },
    assertNoCommands: () => assert.deepEqual(fixture.calls, []),
    replyWith: reader => { readPage = reader; },
    async open({ baseUrl, page }, { initialCount = 10 } = {}) {
      reads = []; entries.splice(0, entries.length, ...historyPage(initialCount, true, 'Initial').entries);
      await bootstrapAdminThroughUi(page, { baseUrl });
      await page.goto(`${baseUrl}/app/settings/library-browser?artistId=${metadataCommandIds.artist}`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Load more history', exact: true }).waitFor();
    },
  };
}

/** DOM viewport geometry also works when native tab zoom changes CSS dimensions. */
export async function assertHistoryTargetVisible(locator) {
  const state = await locator.evaluate(node => {
    const doc = node.ownerDocument; const view = doc.defaultView;
    const main = doc.querySelector('.hx-main'); const bounds = node.getBoundingClientRect(); const workspace = main.getBoundingClientRect();
    const nav = doc.querySelector('.hx-bottom-nav'); const style = view.getComputedStyle(node);
    const navigationTop = nav && view.getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect().top : view.innerHeight;
    const panel = node.closest('section'); const outline = Number.parseFloat(style.outlineWidth); const offset = Number.parseFloat(style.outlineOffset);
    return { focused: doc.activeElement === node, top: bounds.top, bottom: bounds.bottom, left: bounds.left, right: bounds.right,
      visibleTop: Math.max(0, workspace.top), visibleBottom: Math.min(workspace.bottom, view.innerHeight, navigationTop),
      visibleLeft: Math.max(0, workspace.left), visibleRight: Math.min(workspace.right, view.innerWidth),
      width: view.innerWidth, height: view.innerHeight, outline, cue: outline + Math.max(0, offset),
      rootFits: doc.documentElement.scrollWidth <= doc.documentElement.clientWidth,
      workspaceFits: main.scrollWidth <= main.clientWidth, panelFits: panel.scrollWidth <= panel.clientWidth };
  });
  assert.equal(state.focused, true, 'the interaction must retain its owned target');
  assert.ok(state.outline >= 2, 'the keyboard cue must retain the project outline');
  assert.ok(state.top - state.cue >= state.visibleTop && state.bottom + state.cue <= state.visibleBottom, 'target and full outline must fit above fixed navigation');
  assert.ok(state.left - state.cue >= state.visibleLeft && state.right + state.cue <= state.visibleRight, 'target and outline must fit the horizontal workspace');
  for (const key of ['rootFits', 'workspaceFits', 'panelFits']) assert.equal(state[key], true, key);
  return state;
}
