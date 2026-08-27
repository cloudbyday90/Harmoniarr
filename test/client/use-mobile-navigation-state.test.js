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

import {
  createMobileNavigationState,
  mobileNavigationMediaQuery,
} from '../../src/client/composables/useMobileNavigationState.js';

function createMediaQueryList(matches = false) {
  const listeners = new Set();

  return {
    matches,
    addEventListener(eventName, listener) {
      if (eventName === 'change') listeners.add(listener);
    },
    removeEventListener(eventName, listener) {
      if (eventName === 'change') listeners.delete(listener);
    },
    emit(nextMatches) {
      this.matches = nextMatches;
      for (const listener of listeners) listener({ matches: nextMatches });
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

test('createMobileNavigationState follows the configured media query and removes its listener', () => {
  const mediaQueryList = createMediaQueryList(false);
  const requestedQueries = [];
  const state = createMobileNavigationState({
    matchMediaFn(query) {
      requestedQueries.push(query);
      return mediaQueryList;
    },
  });

  state.start();

  assert.deepEqual(requestedQueries, [mobileNavigationMediaQuery]);
  assert.equal(state.isMobileNavigation.value, false);
  assert.equal(mediaQueryList.listenerCount(), 1);

  mediaQueryList.emit(true);
  assert.equal(state.isMobileNavigation.value, true);

  state.stop();
  assert.equal(mediaQueryList.listenerCount(), 0);

  mediaQueryList.emit(false);
  assert.equal(state.isMobileNavigation.value, true);
});

test('createMobileNavigationState keeps desktop state when matchMedia is unavailable', () => {
  const state = createMobileNavigationState({ matchMediaFn: null });

  state.start();

  assert.equal(state.isMobileNavigation.value, false);
});
