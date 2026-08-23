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
import { createMusicQueueReleaseMutationFocusController } from '../../src/client/lib/music-queue-release-mutation-focus-controller.js';

test('Music Queue keeps focus with a retained mutation action', () => {
  const controller = createMusicQueueReleaseMutationFocusController();
  const trigger = { isConnected: true };
  const body = {};
  const mutationId = controller.startMutation({ trigger, wasFocused: true });

  assert.equal(controller.takeFocusTarget({
    actionTarget: trigger,
    activeElement: trigger,
    bodyElement: body,
    mutationId,
    outcomeTarget: { isConnected: true },
  }), null);
});

test('Music Queue focuses a replacement action when the original action rerenders', () => {
  const controller = createMusicQueueReleaseMutationFocusController();
  const trigger = { isConnected: false };
  const replacementAction = { isConnected: true };
  const body = {};
  const mutationId = controller.startMutation({ trigger, wasFocused: true });

  assert.equal(controller.takeFocusTarget({
    actionTarget: replacementAction,
    activeElement: body,
    bodyElement: body,
    mutationId,
    outcomeTarget: { isConnected: true },
  }), replacementAction);
});

test('Music Queue focuses the outcome heading only when a focused mutation action is removed', () => {
  const controller = createMusicQueueReleaseMutationFocusController();
  const trigger = { isConnected: false };
  const outcomeTarget = { isConnected: true };
  const body = {};
  const mutationId = controller.startMutation({ trigger, wasFocused: true });

  assert.equal(controller.takeFocusTarget({
    activeElement: body,
    bodyElement: body,
    mutationId,
    outcomeTarget,
  }), outcomeTarget);
});

test('Music Queue does not overwrite focus the operator moved during a mutation', () => {
  const controller = createMusicQueueReleaseMutationFocusController();
  const trigger = { isConnected: false };
  const newerFocus = { isConnected: true };
  const mutationId = controller.startMutation({ trigger, wasFocused: true });

  assert.equal(controller.takeFocusTarget({
    activeElement: newerFocus,
    bodyElement: {},
    mutationId,
    outcomeTarget: { isConnected: true },
  }), null);
});

test('Music Queue leaves mouse-originated mutations without a focus repair', () => {
  const controller = createMusicQueueReleaseMutationFocusController();
  const trigger = { isConnected: false };
  const body = {};
  const mutationId = controller.startMutation({ trigger, wasFocused: false });

  assert.equal(controller.takeFocusTarget({
    activeElement: body,
    bodyElement: body,
    mutationId,
    outcomeTarget: { isConnected: true },
  }), null);
});
