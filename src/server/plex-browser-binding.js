/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createOpaqueToken, serializeCookie } from './security.js';
import { resolveSecureCookiesEnabled } from './deployment-security-service.js';
import { isPlexBrowserBinding, plexCallbackLifetimeSeconds } from './integrations/plex/plex-callback-policy.js';

export const plexBrowserBindingCookieName = (secure, kind = 'sign_in') => {
  if (!['sign_in', 'owner_link'].includes(kind)) throw new TypeError('Unknown Plex browser binding');
  const name = kind === 'owner_link' ? 'harmoniarr_plex_link_binding' : 'harmoniarr_plex_binding';
  return secure ? '__Host-' + name : name;
};
export const createPlexBrowserBinding = () => createOpaqueToken();
export function readPlexBrowserBinding(request, kind = 'sign_in') {
  const name = plexBrowserBindingCookieName(request.deploymentSecurityPolicy?.secureCookies ?? resolveSecureCookiesEnabled(), kind);
  const matches = (request.headers.cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(name + '='));
  if (matches.length !== 1) return null;
  try { const value = decodeURIComponent(matches[0].slice(name.length + 1)); return isPlexBrowserBinding(value) ? value : null; }
  catch { return null; }
}
export function setPlexBrowserBindingCookie(response, value, kind = 'sign_in') {
  if (!isPlexBrowserBinding(value)) throw new TypeError('A browser binding is required');
  const secure = response.locals?.deploymentSecurityPolicy?.secureCookies ?? resolveSecureCookiesEnabled();
  const cookie = serializeCookie(plexBrowserBindingCookieName(secure, kind), value, { path: '/', httpOnly: true, sameSite: 'Lax', secure, maxAge: plexCallbackLifetimeSeconds });
  const existing = response.getHeader('Set-Cookie');
  response.setHeader('Set-Cookie', [...(Array.isArray(existing) ? existing : existing ? [existing] : []), cookie]);
}
