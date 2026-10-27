/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createOpaqueToken, serializeCookie } from './security.js';
import { resolveSecureCookiesEnabled } from './deployment-security-service.js';
import { oauthLinkNames, isOAuthBinding } from './integrations/providers/oauth-link-policy.js';

export const createOAuthBrowserBinding = () => createOpaqueToken();
export function oauthBrowserCookieName(provider, secure) {
  oauthLinkNames(provider);
  return (secure ? '__Host-' : '') + `harmoniarr_${provider}_binding`;
}
export function readOAuthBrowserBinding(request, provider) {
  const name = oauthBrowserCookieName(provider, request.deploymentSecurityPolicy?.secureCookies ?? resolveSecureCookiesEnabled());
  const matches = (request.headers.cookie ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(name + '='));
  if (matches.length !== 1) return null;
  try { const value = decodeURIComponent(matches[0].slice(name.length + 1)); return isOAuthBinding(value) ? value : null; }
  catch { return null; }
}
export function setOAuthBrowserBindingCookie(response, provider, value) {
  if (!isOAuthBinding(value)) throw new TypeError('A browser binding is required');
  const secure = response.locals?.deploymentSecurityPolicy?.secureCookies ?? resolveSecureCookiesEnabled();
  const cookie = serializeCookie(oauthBrowserCookieName(provider, secure), value, { path: '/', httpOnly: true, sameSite: 'Lax', secure, maxAge: 600 });
  const existing = response.getHeader('Set-Cookie');
  response.setHeader('Set-Cookie', [...(Array.isArray(existing) ? existing : existing ? [existing] : []), cookie]);
}
