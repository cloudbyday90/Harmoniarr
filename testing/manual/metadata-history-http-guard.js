/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

const authenticationPosts = new Set(['/api/v1/bootstrap/admin', '/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/logout']);

/** Deny before dispatch, including provider-backed GETs. Fault controls stay off HTTP. */
export function createManualHistoryHttpGuard({ artistId, onboarding, overview }) {
  let origin = null;
  const reads = new Set(['/api/v1/bootstrap/status', '/api/v1/auth/session', `/api/v1/metadata/artists/${artistId}`, `/api/v1/metadata/artists/${artistId}/detection-events`]);
  function bind(baseUrl) {
    const url = new URL(baseUrl);
    if (origin || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw new TypeError('Manual history fixture requires one owned loopback origin.');
    }
    origin = url.origin;
  }
  function middleware(request, response, next) {
    const refuse = () => response.status(403).json({ ok: false, error: { code: 'manual_fixture_route_refused', message: 'This route is outside the read-only manual history fixture.' } });
    response.set('Cache-Control', 'no-store');
    if (!origin || request.headers.host !== new URL(origin).host ||
        (request.headers.origin !== undefined && request.headers.origin !== origin) ||
        ![undefined, 'none', 'same-origin'].includes(request.headers['sec-fetch-site'])) return refuse();
    const path = request.path;
    if (request.method === 'GET') {
      if (path === '/api/v1/system/onboarding') return response.json(onboarding);
      if (path === '/api/v1/system/overview') return response.json(overview);
      if (reads.has(path) || ['/bootstrap', '/login', '/app', '/app/settings/library-browser', '/manifest.webmanifest', '/favicon.ico'].includes(path) || /^\/(?:assets|icons)\/[^/]+$/u.test(path)) return next();
    }
    if (request.method === 'POST' && authenticationPosts.has(path)) return next();
    return refuse();
  }
  return { bind, middleware };
}
