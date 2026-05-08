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
 * Pure URL classification helpers for the PWA service worker.
 *
 * Exported from this module (importable in Node tests) and mirrored inline
 * inside service-worker.js (which cannot import from the Vite bundle at runtime).
 *
 * Keep both copies in sync when editing the constants or logic.
 */

/** Cache namespace. Bump when cache structure changes to force a clean sweep. */
export const CACHE_VERSION = 'harmoniarr-v1';

/** Cache bucket names derived from the version string. */
export const SHELL_CACHE_NAME = `${CACHE_VERSION}-shell`;
export const ASSETS_CACHE_NAME = `${CACHE_VERSION}-assets`;

/**
 * URLs pre-cached during service worker install.
 * These form the minimal app shell so the app loads offline on repeat visits.
 */
export const SHELL_PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

/**
 * Matches Vite's hashed output filenames under /assets/.
 * Pattern: /assets/<name>-<hash8+>.<ext>
 * These assets are immutable: the URL changes when content changes, so they
 * can be cached indefinitely without ever revalidating.
 */
export const IMMUTABLE_ASSET_RE =
  /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|ttf|otf|svg|png|jpg|jpeg|webp|avif|ico)$/;

/**
 * @typedef {'passthrough' | 'network-only' | 'cache-first-immutable' | 'cache-first-shell' | 'network-first-nav'} FetchClassification
 */

/**
 * Classify a fetch request to determine which caching strategy to apply.
 *
 * Returns one of:
 *   'passthrough'          — let the browser handle it normally (no SW interception)
 *   'network-only'         — fetch from network; never read or write the cache
 *   'cache-first-immutable'— serve from ASSETS cache; fetch and cache on miss (immutable)
 *   'cache-first-shell'    — serve from SHELL cache; fetch and cache on miss
 *   'network-first-nav'    — fetch from network; fall back to cached '/' app shell
 *
 * @param {{ origin: string, pathname: string }} url - Parsed URL of the request.
 * @param {string} mode - The request.mode ('navigate', 'cors', 'same-origin', etc.).
 * @param {string} swOrigin - The service worker's own origin (self.location.origin).
 * @returns {FetchClassification}
 */
export function classifyFetchRequest(url, mode, swOrigin) {
  // Cross-origin requests are never intercepted.
  if (url.origin !== swOrigin) return 'passthrough';

  // API routes carry live data and must always go to the network.
  if (url.pathname.startsWith('/api/')) return 'network-only';

  // HTML navigation — network-first so the page is always fresh when online.
  if (mode === 'navigate') return 'network-first-nav';

  // Vite hashed assets — immutable, cache forever.
  if (IMMUTABLE_ASSET_RE.test(url.pathname)) return 'cache-first-immutable';

  // Icons and manifest — change rarely, serve from shell cache.
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    return 'cache-first-shell';
  }

  return 'passthrough';
}

/**
 * Return true if the given cache key belongs to a previous CACHE_VERSION and
 * should be deleted during service worker activation.
 *
 * @param {string} key - A cache storage key.
 * @returns {boolean}
 */
export function isStaleCache(key) {
  return !key.startsWith(CACHE_VERSION);
}
