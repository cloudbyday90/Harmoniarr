/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { effectScope } from 'vue';
import { useFolderBrowser } from '../../src/client/composables/useFolderBrowser.js';

function fixture() {
  const requests = [];
  const scope = effectScope();
  const browser = scope.run(() => useFolderBrowser({ browse: options => new Promise((resolve, reject) => {
    requests.push({ ...options, resolve, reject });
  }) }));
  return { browser, requests, scope };
}
const result = path => ({ ok: true, path, parent: '/', entries: [{ name: 'Albums', path: `${path}/albums` }] });

test('folder selection requires the latest successful read, including an explicit root read', async () => {
  const { browser, requests, scope } = fixture();
  assert.equal(browser.currentPath.value, null);
  assert.equal(browser.canSelect.value, false);
  const pending = browser.navigate('/');
  assert.equal(browser.canSelect.value, false);
  requests[0].resolve(result('/'));
  await pending;
  assert.equal(browser.currentPath.value, '/');
  assert.equal(browser.canSelect.value, true);
  const next = browser.navigate('/music');
  assert.equal(browser.canSelect.value, false);
  assert.deepEqual(browser.entries.value, []);
  requests[1].resolve(result('/music'));
  await next;
  assert.equal(browser.currentPath.value, '/music');
  scope.stop();
  assert.equal(browser.canSelect.value, false);
});

for (const late of ['resolve', 'reject']) test(`superseded ${late} cannot publish or clear a newer pending read`, async () => {
  const { browser, requests, scope } = fixture();
  const first = browser.navigate('/old');
  const second = browser.navigate('/new');
  assert.equal(requests[0].signal.aborted, true);
  if (late === 'resolve') requests[0].resolve(result('/old'));
  else requests[0].reject(new Error('private details'));
  await first;
  assert.equal(browser.isLoading.value, true);
  assert.equal(browser.errorMessage.value, '');
  assert.equal(browser.currentPath.value, null);
  requests[1].resolve(result('/new')); await second;
  assert.equal(browser.currentPath.value, '/new');
  assert.equal(browser.canSelect.value, true);
  scope.stop();
});

test('late success after a newer success cannot replace its confirmed path or entries', async () => {
  const { browser, requests, scope } = fixture();
  const first = browser.navigate('/old'), second = browser.navigate('/new');
  requests[1].resolve(result('/new')); await second;
  requests[0].resolve(result('/old')); await first;
  assert.equal(browser.currentPath.value, '/new');
  assert.equal(browser.entries.value[0].path, '/new/albums');
  scope.stop();
});

test('failed initial read never grants fallback selection; explicit retry can recover', async () => {
  const { browser, requests, scope } = fixture();
  const first = browser.navigate('/private');
  requests[0].reject(new Error('sensitive native details')); await first;
  assert.equal(browser.currentPath.value, null);
  assert.equal(browser.requestedPath.value, '/private');
  assert.equal(browser.canSelect.value, false);
  assert.equal(browser.errorMessage.value.includes('sensitive'), false);
  const retry = browser.navigate(browser.requestedPath.value);
  assert.equal(browser.errorMessage.value, '');
  requests[1].resolve(result('/private')); await retry;
  assert.equal(browser.canSelect.value, true);
  scope.stop();
});

for (const payload of [null, { ...result('/wrong'), ok: false }, { ...result('/bad'), path: '' },
  { ...result('/bad'), entries: null }, { ...result('/bad'), entries: [{ name: 'A' }] },
  { ...result('/bad'), entries: [result('/x').entries[0], result('/x').entries[0]] }]) {
  test('unconfirmed or malformed directory result refuses selection', async () => {
    const { browser, requests, scope } = fixture();
    const pending = browser.navigate('/requested'); requests[0].resolve(payload); await pending;
    assert.equal(browser.currentPath.value, null);
    assert.equal(browser.canSelect.value, false);
    assert.ok(browser.errorMessage.value);
    scope.stop();
  });
}

for (const late of ['resolve', 'reject']) test(`scope retirement fences late ${late} even if transport ignores abort`, async () => {
  const { browser, requests, scope } = fixture();
  const pending = browser.navigate('/retired'); scope.stop();
  assert.equal(requests[0].signal.aborted, true);
  if (late === 'resolve') requests[0].resolve(result('/retired'));
  else requests[0].reject(new Error('late'));
  await pending;
  assert.equal(browser.currentPath.value, null);
  assert.equal(browser.canSelect.value, false);
  assert.equal(browser.errorMessage.value, '');
  await browser.navigate('/new');
  assert.equal(requests.length, 1);
  browser.dispose();
});
