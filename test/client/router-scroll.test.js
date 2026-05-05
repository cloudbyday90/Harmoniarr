import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveRouterScroll } from '../../src/client/lib/router-scroll.js';

test('resolveRouterScroll preserves saved browser positions', () => {
  const savedPosition = { left: 0, top: 420 };

  assert.equal(resolveRouterScroll({ hash: '' }, {}, savedPosition), savedPosition);
});

test('resolveRouterScroll targets hash anchors when present', () => {
  assert.deepEqual(resolveRouterScroll({ hash: '#users-access' }, {}, null), {
    el: '#users-access',
  });
});

test('resolveRouterScroll resets to the top for ordinary route changes', () => {
  assert.deepEqual(resolveRouterScroll({ hash: '' }, {}, null), {
    top: 0,
  });
});