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
 * Harmoniarr Service Worker
 *
 * Caching strategy:
 *   - App shell (HTML, icons, manifest): pre-cached on install; network-first
 *     for HTML navigation so the page is always fresh when online.
 *   - Vite hashed assets (/assets/*-HASH.ext): cache-first, cached indefinitely
 *     (the URL changes when content changes, so stale data is impossible).
 *   - API routes (/api/*): never cached — always fetch from the network.
 *   - Cross-origin requests: never intercepted.
 *
 * Update flow:
 *   - The page calls registration.waiting.postMessage({ type: 'SKIP_WAITING' })
 *     when the user confirms the update banner.
 *   - This SW then calls self.skipWaiting(), triggers controllerchange on the
 *     page, and the page reloads to pick up the new version.
 *
 * NOTE: This file runs outside the Vite build pipeline (it lives in public/).
 * It cannot import from the Vite bundle. The cache constants and URL
 * classification logic are kept in sync with src/client/lib/pwa-cache-policy.js,
 * which is the testable mirror of this inline logic.
 */

// ── Cache names ───────────────────────────────────────────────────────────────
// Bump CACHE_VERSION when cache structure changes to force clean-up of old caches.

const CACHE_VERSION = 'harmoniarr-v1';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSETS_CACHE = `${CACHE_VERSION}-assets`;

// ── Shell pre-cache list ──────────────────────────────────────────────────────

const SHELL_PRECACHE_URLS = [
  '/',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];

// ── Immutable asset pattern (Vite output: /assets/<name>-<hash8+>.<ext>) ─────

const IMMUTABLE_ASSET_RE =
  /^\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2?|ttf|otf|svg|png|jpg|jpeg|webp|avif|ico)$/;

// ── Install: pre-cache the app shell ─────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_PRECACHE_URLS).catch((err) => {
        // Don't block install on pre-cache failure (e.g. offline at install time).
        // The shell assets will be cached on first use via the fetch handlers.
        console.warn('[SW] Shell pre-cache failed:', err);
      }),
    ),
  );
  // Do NOT call skipWaiting() here. Updates are triggered explicitly by the user
  // via the update banner, which posts { type: 'SKIP_WAITING' }.
});

// ── Activate: clean up stale caches and claim all clients ────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        const stale = keys.filter((k) => !k.startsWith(CACHE_VERSION));
        return Promise.all(stale.map((k) => caches.delete(k)));
      })
      .then(() => self.clients.claim()),
  );
});

// ── Message: explicit skip-waiting trigger from the update banner ─────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Fetch: routing and caching strategies ────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Cross-origin: never intercept.
  if (url.origin !== self.location.origin) return;

  // API routes: network-only — live data must never be served stale.
  if (url.pathname.startsWith('/api/')) return;

  // HTML navigation: network-first with offline app-shell fallback.
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNav(request));
    return;
  }

  // Vite hashed assets: cache-first, cached indefinitely.
  if (IMMUTABLE_ASSET_RE.test(url.pathname)) {
    event.respondWith(cacheFirstImmutable(request));
    return;
  }

  // Icons and manifest: cache-first from the shell cache.
  if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(cacheFirstShell(request));
    return;
  }
});

// ── Strategy implementations ──────────────────────────────────────────────────

/**
 * Network-first for HTML navigation.
 * On success: update the shell cache with the fresh response.
 * On network failure: fall back to the cached '/' app shell so the Vue SPA
 *   can boot and handle the URL client-side.
 */
async function networkFirstNav(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match('/');
    return cached ?? Response.error();
  }
}

/**
 * Cache-first for immutable Vite hashed assets.
 * Cache hit: return immediately (no network round-trip).
 * Cache miss: fetch, store in assets cache, return response.
 */
async function cacheFirstImmutable(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(ASSETS_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

/**
 * Cache-first for shell static files (icons, manifest).
 * Same as cacheFirstImmutable but stores in the shell cache bucket.
 */
async function cacheFirstShell(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return Response.error();
  }
}

// ── Push notifications ────────────────────────────────────────────────────────

/**
 * Push event: received a push message from the server.
 *
 * The payload is a JSON object: { title, body, icon?, url? }
 * Defaults are used if the payload is absent or malformed.
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    // Malformed JSON — use defaults.
  }

  const title = typeof data.title === 'string' && data.title ? data.title : 'Harmoniarr';
  const body = typeof data.body === 'string' && data.body ? data.body : 'You have a new notification.';
  const icon = typeof data.icon === 'string' && data.icon ? data.icon : '/icons/icon-192.png';
  const badge = '/icons/icon-192.png';
  const url = typeof data.url === 'string' && data.url ? data.url : '/app/my-requests';

  event.waitUntil(
    self.registration.showNotification(title, {
      badge,
      body,
      data: { url },
      icon,
    }),
  );
});

/**
 * Notification click: open / focus the app and navigate to the linked route.
 *
 * Iterates over open clients first to avoid opening a duplicate tab.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/app/my-requests';

  event.waitUntil(
    self.clients
      .matchAll({ includeUncontrolled: true, type: 'window' })
      .then((clientList) => {
        // If the app is already open, focus it and navigate.
        for (const client of clientList) {
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) {
              client.navigate(targetUrl);
            }
            return;
          }
        }

        // No open window — open a new one.
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
