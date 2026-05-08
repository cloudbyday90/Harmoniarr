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

import { readonly, ref } from 'vue';
import { createPwaRegistration } from '../lib/pwa-registration.js';

/**
 * Vue composable for PWA update awareness.
 *
 * On first call (in a production build), registers the service worker and
 * begins listening for updates. Subsequent calls from any component share
 * the same reactive state — there is exactly one SW registration per page.
 *
 * Dependencies are injectable so the composable can be tested in Node without
 * a real service worker or DOM globals.
 *
 * @param {object} [opts]
 * @param {boolean}  [opts.enabled]          - Override for production check. Defaults to import.meta.env.PROD.
 * @param {function} [opts.createRegistration] - Factory for the registration handle (injectable in tests).
 * @returns {{ isUpdateAvailable: Ref<boolean>, applyUpdate: function }}
 */

// Module-level shared state — one registration per browser page, shared by all
// component instances that call usePwaUpdate().
const _isUpdateAvailable = ref(false);
let _registration = null;
let _initialized = false;

export function usePwaUpdate({
  enabled = typeof import.meta !== 'undefined' && import.meta.env?.PROD === true,
  createRegistration = createPwaRegistration,
} = {}) {
  if (!_initialized && enabled) {
    _initialized = true;
    _registration = createRegistration();
    _registration.init({
      onUpdateAvailable: () => {
        _isUpdateAvailable.value = true;
      },
    });
  }

  function applyUpdate() {
    _registration?.applyUpdate();
  }

  return {
    /** True when a new service worker has installed and is waiting to activate. */
    isUpdateAvailable: readonly(_isUpdateAvailable),
    /**
     * Post SKIP_WAITING to the waiting SW, triggering a controllerchange event
     * that will reload the page.
     */
    applyUpdate,
  };
}

/**
 * Reset module-level state. Exported only for use in test suites.
 * Do not call in application code.
 */
export function _resetPwaUpdateState() {
  _isUpdateAvailable.value = false;
  _registration = null;
  _initialized = false;
}
