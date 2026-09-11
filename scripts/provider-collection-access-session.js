/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createSessionHttpClient } from '../src/shared/http-session-client.js';
import { readBoundedJsonResponse } from '../src/server/integrations/providers/provider-json-response.js';
import { buildProviderCollectionAccessEvidence } from './provider-collection-access-evidence.js';

export function normalizeProviderAccessBaseUrl(value) {
  try {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/'
      || !(url.protocol === 'https:' || (url.protocol === 'http:' && loopback))) throw new Error();
    return url.origin;
  } catch { throw new Error('Use an HTTPS application origin or an HTTP loopback origin without a path or credentials'); }
}

export async function collectProviderCollectionAccessEvidence({
  baseUrl, username, password, sourceUrl, fetchFn = fetch, getNow = () => new Date(),
}) {
  const origin = normalizeProviderAccessBaseUrl(baseUrl);
  const paths = new Set(['/api/v1/auth/login', '/api/v1/providers/collection-access-check', '/api/v1/auth/logout']);
  const client = createSessionHttpClient(origin, {
    requestTimeoutMs: 35_000,
    fetchFn: async (target, options) => {
      const url = new URL(target);
      if (url.origin !== origin || !paths.has(url.pathname) || url.search || options.method !== 'POST') throw new Error();
      const response = await fetchFn(target, { ...options, redirect: 'error' });
      const payload = await readBoundedJsonResponse(response, { signal: options.signal, maxResponseBytes: 65_536 });
      return { headers: response.headers, ok: response.ok, status: response.status, json: async () => payload };
    },
  });
  let evidence;
  let stage = 'login';
  let failure = null;
  let sessionClosed = true;
  try {
    const login = await client.requestJson('/api/v1/auth/login', { method: 'POST', csrf: false, json: { username, password } });
    if (!login.response.ok || !client.getCookieHeader() || !client.getCsrfToken()) throw new Error();
    stage = 'check';
    const result = await client.requestJson('/api/v1/providers/collection-access-check', { method: 'POST', json: { sourceUrl } });
    if (!result.response.ok || result.payload?.ok !== true) throw new Error();
    stage = 'evidence';
    evidence = buildProviderCollectionAccessEvidence(result.payload.check, { observedAt: getNow().toISOString() });
  } catch {
    failure = new Error({
      login: 'Administrator login failed; verify the application and protected password input',
      check: 'The protected collection check failed; verify administrator access, CSRF, and application availability',
      evidence: 'The application returned invalid provider access evidence',
    }[stage]);
  } finally {
    if (client.getCookieHeader()) {
      try {
        const logout = await client.requestJson('/api/v1/auth/logout', { method: 'POST', json: {}, timeoutMs: 10_000 });
        sessionClosed = logout.response.ok;
      } catch { sessionClosed = false; }
    }
  }
  if (failure) throw failure;
  return { evidence, sessionClosed };
}
