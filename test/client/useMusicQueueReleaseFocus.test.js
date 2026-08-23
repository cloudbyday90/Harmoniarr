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
import { useMusicQueueReleaseFocus } from '../../src/client/composables/useMusicQueueReleaseFocus.js';

test('useMusicQueueReleaseFocus waits for the rendered target before focusing it', async (t) => {
  const nextTickFn = t.mock.fn(async () => {});
  const focusElementFn = t.mock.fn(() => true);
  const focus = useMusicQueueReleaseFocus({ focusElementFn, nextTickFn });
  const target = { focus() {} };

  const didFocus = await focus.focusAfterRender(() => target);

  assert.equal(didFocus, true);
  assert.equal(nextTickFn.mock.callCount(), 1);
  assert.equal(focusElementFn.mock.callCount(), 1);
  assert.equal(focusElementFn.mock.calls[0].arguments[0], target);
});

test('useMusicQueueReleaseFocus does not focus a disconnected close target', async (t) => {
  const targetFocus = t.mock.fn();
  const focus = useMusicQueueReleaseFocus({
    nextTickFn: async () => {},
  });
  const target = { focus: targetFocus, isConnected: false };

  assert.equal(await focus.focusAfterRender(target), false);
  assert.equal(targetFocus.mock.callCount(), 0);
});

test('useMusicQueueReleaseFocus tries the queue heading when a row-close target is disconnected', async (t) => {
  const disconnectedFocus = t.mock.fn();
  const fallbackFocus = t.mock.fn();
  const focus = useMusicQueueReleaseFocus({
    nextTickFn: async () => {},
  });
  const disconnectedTarget = { focus: disconnectedFocus, isConnected: false };
  const fallbackTarget = { focus: fallbackFocus };

  assert.equal(await focus.focusFirstAvailableAfterRender([disconnectedTarget, fallbackTarget]), true);
  assert.equal(disconnectedFocus.mock.callCount(), 0);
  assert.equal(fallbackFocus.mock.callCount(), 1);
});

test('useMusicQueueReleaseFocus waits for a ready direct-route heading before recording focus', async (t) => {
  const focusElementFn = t.mock.fn(() => true);
  const focus = useMusicQueueReleaseFocus({
    focusElementFn,
    nextTickFn: async () => {},
  });
  const heading = { focus() {} };

  focus.synchronizeRouteSelection('wanted-quality');
  assert.equal(await focus.focusDirectInspectorHeading({
    headingResolver: () => null,
    isReady: true,
    releaseId: 'wanted-quality',
  }), false);
  assert.equal(await focus.focusDirectInspectorHeading({
    headingResolver: () => heading,
    isReady: true,
    releaseId: 'wanted-quality',
  }), true);
  assert.equal(focusElementFn.mock.callCount(), 1);
});

test('useMusicQueueReleaseFocus re-resolves a replaced direct-route heading before recording focus', async (t) => {
  const nextTickFn = t.mock.fn(async () => {});
  const focusElementFn = t.mock.fn(() => true);
  const focus = useMusicQueueReleaseFocus({ focusElementFn, nextTickFn });
  const replacedHeading = { focus() {}, isConnected: false };
  const renderedHeading = { focus() {} };
  let headingLookupCount = 0;

  focus.synchronizeRouteSelection('wanted-unavailable');
  assert.equal(await focus.focusDirectInspectorHeading({
    headingResolver: () => {
      headingLookupCount += 1;
      return headingLookupCount === 1 ? replacedHeading : renderedHeading;
    },
    isReady: true,
    releaseId: 'wanted-unavailable',
  }), true);
  assert.equal(nextTickFn.mock.callCount(), 2);
  assert.equal(focusElementFn.mock.callCount(), 1);
  assert.equal(focusElementFn.mock.calls[0].arguments[0], renderedHeading);
});
