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

/**
 * PWA service worker registration and update detection.
 *
 * Designed for dependency injection so the navigator and window APIs can be
 * replaced in tests without DOM globals.
 *
 * Usage (production, called once after the app mounts):
 *
 *   import { createPwaRegistration } from './pwa-registration.js';
 *
 *   const registration = createPwaRegistration();
 *   await registration.init({ onUpdateAvailable: () => { showBanner.value = true; } });
 *
 * Update flow:
 *   1. A new service worker installs and moves to 'installed' state while the
 *      old one still controls the page.
 *   2. onUpdateAvailable() is called — the UI shows an update banner.
 *   3. The user clicks "Reload" — the page calls registration.applyUpdate().
 *   4. applyUpdate() posts { type: 'SKIP_WAITING' } to the waiting SW.
 *   5. The SW calls self.skipWaiting(); the browser fires 'controllerchange'.
 *   6. The 'controllerchange' listener calls location.reload().
 */

const SW_PATH = '/service-worker.js';

/**
 * Create a self-contained PWA registration handle.
 * All browser globals are injectable for testing.
 *
 * @param {object} [deps]
 * @param {Navigator}  [deps.nav]         - Defaults to `navigator`.
 * @param {Window}     [deps.win]         - Defaults to `window`.
 * @param {string}     [deps.swPath]      - Path to the service worker file.
 * @returns {{ init: function, applyUpdate: function }}
 */
export function createPwaRegistration({ nav = navigator, win = window, swPath = SW_PATH } = {}) {
  /** @type {ServiceWorkerRegistration | null} */
  let _registration = null;
  let _isRefreshing = false;

  /**
   * Register the service worker and wire update detection.
   *
   * Safe to call when serviceWorker is not supported — returns immediately.
   *
   * @param {object}   opts
   * @param {function} opts.onUpdateAvailable - Called when a new SW is waiting.
   * @returns {Promise<void>}
   */
  async function init({ onUpdateAvailable } = {}) {
    if (!('serviceWorker' in nav)) return;

    try {
      _registration = await nav.serviceWorker.register(swPath);

      // Watch for new SWs installing after the initial registration.
      _registration.addEventListener('updatefound', () => {
        const newWorker = _registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && nav.serviceWorker.controller) {
            // A new SW is waiting; an old one is still in control.
            onUpdateAvailable?.();
          }
        });
      });

      // Reload when a new SW takes over (fires after SKIP_WAITING completes).
      nav.serviceWorker.addEventListener('controllerchange', () => {
        if (_isRefreshing) return;
        _isRefreshing = true;
        win.location.reload();
      });

      // Handle the case where a waiting SW already existed when the page loaded
      // (e.g. user had the page open in another tab during a prior update).
      if (_registration.waiting && nav.serviceWorker.controller) {
        onUpdateAvailable?.();
      }
    } catch (err) {
      // Registration failure is non-fatal — the app works without a SW.
      console.warn('[PWA] Service worker registration failed:', err);
    }
  }

  /**
   * Tell the waiting service worker to activate immediately.
   * The 'controllerchange' listener above will reload the page once it does.
   */
  function applyUpdate() {
    const waiting = _registration?.waiting;
    if (waiting) {
      waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  return { init, applyUpdate };
}
