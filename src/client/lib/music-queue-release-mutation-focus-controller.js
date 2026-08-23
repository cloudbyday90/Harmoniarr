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

function isConnected(target) {
  return Boolean(target) && target.isConnected !== false;
}

/**
 * Retains the minimum ephemeral state needed to repair keyboard focus after a
 * Music Queue mutation replaces the action that began it. DOM and render
 * timing stay outside this pure controller.
 */
export function createMusicQueueReleaseMutationFocusController() {
  let nextMutationId = 0;
  const mutations = new Map();

  function startMutation({ trigger = null, wasFocused = false } = {}) {
    const mutationId = ++nextMutationId;
    mutations.set(mutationId, {
      trigger,
      wasFocused: wasFocused === true,
    });
    return mutationId;
  }

  function takeFocusTarget({
    actionTarget = null,
    activeElement = null,
    bodyElement = null,
    mutationId,
    outcomeTarget = null,
  } = {}) {
    const mutation = mutations.get(mutationId);
    mutations.delete(mutationId);

    if (!mutation?.wasFocused || isConnected(mutation.trigger)) {
      return null;
    }

    // A user may move focus while an asynchronous mutation is in flight. Do
    // not overwrite that newer intent; only repair the browser's body fallback.
    if (activeElement && activeElement !== bodyElement) {
      return null;
    }

    return isConnected(actionTarget) ? actionTarget : outcomeTarget;
  }

  return {
    startMutation,
    takeFocusTarget,
  };
}
