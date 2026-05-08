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
import { describe, it } from 'node:test';
import {
  ASSETS_CACHE_NAME,
  CACHE_VERSION,
  IMMUTABLE_ASSET_RE,
  SHELL_CACHE_NAME,
  SHELL_PRECACHE_URLS,
  classifyFetchRequest,
  isStaleCache,
} from '../../src/client/lib/pwa-cache-policy.js';

// ── Constants ─────────────────────────────────────────────────────────────────

describe('pwa-cache-policy constants', () => {
  it('CACHE_VERSION is a non-empty string', () => {
    assert.equal(typeof CACHE_VERSION, 'string');
    assert.ok(CACHE_VERSION.length > 0);
  });

  it('SHELL_CACHE_NAME starts with CACHE_VERSION', () => {
    assert.ok(SHELL_CACHE_NAME.startsWith(CACHE_VERSION));
  });

  it('ASSETS_CACHE_NAME starts with CACHE_VERSION', () => {
    assert.ok(ASSETS_CACHE_NAME.startsWith(CACHE_VERSION));
  });

  it('SHELL_CACHE_NAME and ASSETS_CACHE_NAME are distinct', () => {
    assert.notEqual(SHELL_CACHE_NAME, ASSETS_CACHE_NAME);
  });

  it('SHELL_PRECACHE_URLS includes the app root URL', () => {
    assert.ok(SHELL_PRECACHE_URLS.includes('/'), 'root "/" must be pre-cached');
  });

  it('SHELL_PRECACHE_URLS includes the manifest', () => {
    assert.ok(SHELL_PRECACHE_URLS.includes('/manifest.webmanifest'));
  });

  it('SHELL_PRECACHE_URLS includes all icon variants', () => {
    assert.ok(SHELL_PRECACHE_URLS.some((u) => u.includes('icon-192')));
    assert.ok(SHELL_PRECACHE_URLS.some((u) => u.includes('icon-512')));
    assert.ok(SHELL_PRECACHE_URLS.some((u) => u.includes('maskable')));
    assert.ok(SHELL_PRECACHE_URLS.some((u) => u.includes('apple-touch-icon')));
  });
});

// ── IMMUTABLE_ASSET_RE ────────────────────────────────────────────────────────

describe('pwa-cache-policy IMMUTABLE_ASSET_RE', () => {
  const match = (path) => IMMUTABLE_ASSET_RE.test(path);

  it('matches a typical Vite JS chunk URL', () => {
    assert.ok(match('/assets/index-CD-y7N8m.js'));
  });

  it('matches a typical Vite CSS URL', () => {
    assert.ok(match('/assets/index-BnhsqfNF.css'));
  });

  it('matches a worker chunk URL', () => {
    assert.ok(match('/assets/color-worker-X3i3jT9b.js'));
  });

  it('matches PNG image assets', () => {
    assert.ok(match('/assets/logo-AbCdEfGh.png'));
  });

  it('matches WebP image assets', () => {
    assert.ok(match('/assets/banner-1A2B3C4D.webp'));
  });

  it('matches woff2 font assets', () => {
    assert.ok(match('/assets/inter-Aa1Bb2Cc.woff2'));
  });

  it('does NOT match paths outside /assets/', () => {
    assert.equal(match('/icons/icon-192.png'), false);
    assert.equal(match('/manifest.webmanifest'), false);
    assert.equal(match('/'), false);
  });

  it('does NOT match paths without a hash segment', () => {
    assert.equal(match('/assets/index.js'), false);
    assert.equal(match('/assets/style.css'), false);
  });

  it('does NOT match paths with a hash shorter than 8 chars', () => {
    assert.equal(match('/assets/index-Ab1.js'), false);
    assert.equal(match('/assets/index-AbCd123.js'), false);
  });

  it('does NOT match API paths', () => {
    assert.equal(match('/api/v1/something'), false);
  });
});

// ── classifyFetchRequest ──────────────────────────────────────────────────────

describe('pwa-cache-policy classifyFetchRequest', () => {
  const ORIGIN = 'https://harmoniarr.local';

  function url(pathname) {
    return { origin: ORIGIN, pathname };
  }

  it('returns passthrough for cross-origin requests', () => {
    const crossOrigin = { origin: 'https://other.example.com', pathname: '/something' };
    assert.equal(classifyFetchRequest(crossOrigin, 'cors', ORIGIN), 'passthrough');
  });

  it('returns network-only for /api/ routes', () => {
    assert.equal(classifyFetchRequest(url('/api/v1/library/releases'), 'cors', ORIGIN), 'network-only');
    assert.equal(classifyFetchRequest(url('/api/v1/activity/feed'), 'same-origin', ORIGIN), 'network-only');
  });

  it('returns network-only for deep /api/ paths', () => {
    assert.equal(classifyFetchRequest(url('/api/v1/metadata/artists/abc/similar'), 'cors', ORIGIN), 'network-only');
  });

  it('returns network-first-nav for navigate mode requests', () => {
    assert.equal(classifyFetchRequest(url('/'), 'navigate', ORIGIN), 'network-first-nav');
    assert.equal(classifyFetchRequest(url('/app/dashboard'), 'navigate', ORIGIN), 'network-first-nav');
    assert.equal(classifyFetchRequest(url('/app/discover'), 'navigate', ORIGIN), 'network-first-nav');
  });

  it('returns network-first-nav for navigate even on the root path', () => {
    assert.equal(classifyFetchRequest(url('/'), 'navigate', ORIGIN), 'network-first-nav');
  });

  it('returns cache-first-immutable for Vite hashed JS chunks', () => {
    assert.equal(
      classifyFetchRequest(url('/assets/index-CD-y7N8m.js'), 'cors', ORIGIN),
      'cache-first-immutable',
    );
  });

  it('returns cache-first-immutable for Vite hashed CSS', () => {
    assert.equal(
      classifyFetchRequest(url('/assets/index-BnhsqfNF.css'), 'cors', ORIGIN),
      'cache-first-immutable',
    );
  });

  it('returns cache-first-shell for icon files', () => {
    assert.equal(classifyFetchRequest(url('/icons/icon-192.png'), 'cors', ORIGIN), 'cache-first-shell');
    assert.equal(classifyFetchRequest(url('/icons/icon-512.png'), 'cors', ORIGIN), 'cache-first-shell');
    assert.equal(classifyFetchRequest(url('/icons/apple-touch-icon.png'), 'cors', ORIGIN), 'cache-first-shell');
    assert.equal(classifyFetchRequest(url('/icons/icon-maskable-512.png'), 'cors', ORIGIN), 'cache-first-shell');
  });

  it('returns cache-first-shell for the manifest', () => {
    assert.equal(classifyFetchRequest(url('/manifest.webmanifest'), 'cors', ORIGIN), 'cache-first-shell');
  });

  it('returns passthrough for unrecognized same-origin paths', () => {
    assert.equal(classifyFetchRequest(url('/unknown-resource.bin'), 'cors', ORIGIN), 'passthrough');
    assert.equal(classifyFetchRequest(url('/healthz'), 'cors', ORIGIN), 'passthrough');
  });

  it('API check takes priority over navigate mode', () => {
    // /api/* navigation requests should still be network-only, not network-first-nav
    assert.equal(classifyFetchRequest(url('/api/v1/auth/session'), 'navigate', ORIGIN), 'network-only');
  });
});

// ── isStaleCache ──────────────────────────────────────────────────────────────

describe('pwa-cache-policy isStaleCache', () => {
  it('returns false for current version cache names', () => {
    assert.equal(isStaleCache(SHELL_CACHE_NAME), false);
    assert.equal(isStaleCache(ASSETS_CACHE_NAME), false);
  });

  it('returns true for cache names with a different version prefix', () => {
    assert.equal(isStaleCache('harmoniarr-v0-shell'), true);
    assert.equal(isStaleCache('harmoniarr-v0-assets'), true);
    assert.equal(isStaleCache('old-cache'), true);
    assert.equal(isStaleCache('workbox-precache-v2'), true);
  });

  it('returns false for the CACHE_VERSION prefix itself', () => {
    assert.equal(isStaleCache(CACHE_VERSION), false);
    assert.equal(isStaleCache(`${CACHE_VERSION}-anything`), false);
  });
});
