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
import { useMusicQueueReleaseMutationFocus } from '../../src/client/composables/useMusicQueueReleaseMutationFocus.js';

test('useMusicQueueReleaseMutationFocus moves a removed focused action to the updated outcome heading', async (t) => {
  const body = {};
  const trigger = { isConnected: true };
  const outcomeFocus = t.mock.fn();
  const outcomeHeading = { focus: outcomeFocus, isConnected: true };
  let activeElement = trigger;
  const focus = useMusicQueueReleaseMutationFocus({
    activeElementFn: () => activeElement,
    bodyElementFn: () => body,
    nextTickFn: async () => {
      trigger.isConnected = false;
      activeElement = body;
    },
  });

  const mutationId = focus.startMutation({ trigger });
  assert.equal(await focus.focusAfterMutation({
    mutationId,
    outcomeHeadingResolver: () => outcomeHeading,
  }), true);
  assert.equal(outcomeFocus.mock.callCount(), 1);
});

test('useMusicQueueReleaseMutationFocus keeps the replacement action in focus', async (t) => {
  const body = {};
  const trigger = { isConnected: true };
  const replacementFocus = t.mock.fn();
  const replacementAction = { focus: replacementFocus, isConnected: true };
  let activeElement = trigger;
  const focus = useMusicQueueReleaseMutationFocus({
    activeElementFn: () => activeElement,
    bodyElementFn: () => body,
    nextTickFn: async () => {
      trigger.isConnected = false;
      activeElement = body;
    },
  });

  const mutationId = focus.startMutation({ trigger });
  assert.equal(await focus.focusAfterMutation({
    actionResolver: () => replacementAction,
    mutationId,
  }), true);
  assert.equal(replacementFocus.mock.callCount(), 1);
});

test('useMusicQueueReleaseMutationFocus does not move focus when the action remains', async (t) => {
  const triggerFocus = t.mock.fn();
  const trigger = { focus: triggerFocus, isConnected: true };
  const focus = useMusicQueueReleaseMutationFocus({
    activeElementFn: () => trigger,
    bodyElementFn: () => ({}),
    nextTickFn: async () => {},
  });

  const mutationId = focus.startMutation({ trigger });
  assert.equal(await focus.focusAfterMutation({ mutationId }), false);
  assert.equal(triggerFocus.mock.callCount(), 0);
});
