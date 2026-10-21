/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { withBrowserSession } from '../../testing/browser/browser-session.js';
import { withResolvers } from '../../testing/client/promise-helpers.js';

function fixture() {
  const calls = [];
  const browserContext = {
    async unrouteAll(options) { assert.equal(this, browserContext); assert.deepEqual(options, { behavior: 'ignoreErrors' }); calls.push('unroute'); },
    async close() { assert.equal(this, browserContext); calls.push('context-close'); },
  };
  const browser = {
    async newContext(options) { assert.equal(this, browser); assert.deepEqual(options, { serviceWorkers: 'block' }); calls.push('context'); return browserContext; },
    async close() { assert.equal(this, browser); calls.push('browser-close'); },
  };
  const browserType = { async launch(options) { assert.equal(this, browserType); assert.deepEqual(options, { headless: true }); calls.push('launch'); return browser; } };
  return { browserType, browser, browserContext, calls };
}

async function rejectsOriginal(operation, failure) {
  let caught = false;
  try { await operation; } catch (error) { caught = true; assert.equal(error, failure); }
  assert.equal(caught, true);
}

test('browser session keeps its capabilities alive through returned work and drains cleanup before returning', async t => {
  const ui = fixture(); const body = withResolvers(); const closing = withResolvers(); const entered = withResolvers(); const closeEntered = withResolvers(); let returned = false;
  ui.browser.close = async () => { ui.calls.push('browser-close'); closeEntered.resolve(); await closing.promise; };
  const pending = withBrowserSession(ui, async session => { assert.equal(session.browser, ui.browser); assert.equal(session.browserContext, ui.browserContext); entered.resolve(); await body.promise; return 'result'; }).then(value => { returned = true; return value; });
  t.after(async () => { body.resolve(); closing.resolve(); await pending; });
  await entered.promise; assert.deepEqual(ui.calls, ['launch', 'context']);
  body.resolve(); await closeEntered.promise; assert.equal(returned, false);
  closing.resolve(); assert.equal(await pending, 'result'); assert.equal(returned, true);
  assert.deepEqual(ui.calls, ['launch', 'context', 'unroute', 'context-close', 'browser-close']);
});

test('launch Error/null is preserved without closing nonexistent resources', async () => {
  for (const failure of [new Error('launch'), null]) {
    const ui = fixture(); ui.browserType.launch = async () => { throw failure; };
    await rejectsOriginal(withBrowserSession(ui, () => assert.fail('unreachable')), failure); assert.deepEqual(ui.calls, []);
  }
});

test('context creation Error/null still awaits the owned browser close', async () => {
  for (const failure of [new Error('context'), null]) {
    const ui = fixture(); ui.browser.newContext = async () => { throw failure; };
    await rejectsOriginal(withBrowserSession(ui, () => assert.fail('unreachable')), failure);
    assert.deepEqual(ui.calls, ['launch', 'browser-close']);
  }
});

test('setup or body Error/null survives cleanup errors while every retirement is attempted', async () => {
  for (const failure of [new Error('setup/body'), null]) {
    const ui = fixture();
    ui.browserContext.unrouteAll = async () => { ui.calls.push('unroute'); throw new Error('routes'); };
    ui.browserContext.close = async () => { ui.calls.push('context-close'); throw null; };
    await rejectsOriginal(withBrowserSession(ui, () => { throw failure; }), failure);
    assert.deepEqual(ui.calls, ['launch', 'context', 'unroute', 'context-close', 'browser-close']);
  }
});

test('otherwise successful scenarios report the first cleanup Error/null and still close the browser', async () => {
  for (const failure of [new Error('retirement'), null]) {
    const ui = fixture(); ui.browserContext.unrouteAll = async () => { ui.calls.push('unroute'); throw failure; };
    ui.browserContext.close = async () => { ui.calls.push('context-close'); throw new Error('later'); };
    await rejectsOriginal(withBrowserSession(ui, () => 'passed body'), failure);
    assert.equal(ui.calls.at(-1), 'browser-close');
  }
});

test('invalid browser capabilities or work fail before launch', async () => {
  const ui = fixture(); await assert.rejects(withBrowserSession({ browserType: {} }, () => {}), TypeError);
  await assert.rejects(withBrowserSession(ui, null), TypeError); assert.deepEqual(ui.calls, []);
});
