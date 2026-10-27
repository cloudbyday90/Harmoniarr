/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createProviderRequestError } from './provider-request-error.js';

const origins = { spotify: ['https://api.spotify.com', 'https://accounts.spotify.com'], youtube: ['https://www.googleapis.com', 'https://oauth2.googleapis.com'] };
export function admitProviderDestination(value, provider) {
  let url;
  try { url = new URL(value); } catch { throw createProviderRequestError(provider, 'request_rejected'); }
  const allowed = provider ? origins[provider] : Object.values(origins).flat();
  if (!allowed?.includes(url.origin) || url.username || url.password || url.hash || url.port) throw createProviderRequestError(provider, 'request_rejected');
  return url;
}
export function providerTransportError(reason) {
  const error = new Error('Provider transport failed');
  error.transportFailure = ['timeout', 'oversized', 'redirect', 'invalid', 'unavailable'].includes(reason) ? reason : 'unavailable'; return error;
}
export function captureProviderHttpRequest({ provider, url, method = 'GET', headers = {}, body, maxBytes = 2_000_000, timeoutMs = 15_000, empty = false }) {
  const destination = admitProviderDestination(url, provider).href;
  if (!['GET', 'POST'].includes(method) || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 2_000_000
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000 || (empty && destination !== 'https://oauth2.googleapis.com/revoke')) throw createProviderRequestError(provider, 'request_rejected');
  const acceptedHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!['accept', 'authorization', 'content-type', 'accept-encoding'].includes(key.toLowerCase()) || typeof value !== 'string' || value.length > 8192 || /[\r\n\0]/u.test(value)) throw createProviderRequestError(provider, 'request_rejected');
    acceptedHeaders[key] = value;
  }
  if (body != null && typeof body !== 'string' && !Buffer.isBuffer(body) && !(body instanceof URLSearchParams)) throw createProviderRequestError(provider, 'request_rejected');
  const value = body instanceof URLSearchParams ? body.toString() : body;
  if (value != null && Buffer.byteLength(value) > 65_536) throw createProviderRequestError(provider, 'request_rejected');
  const acceptedBody = value == null ? undefined : Buffer.from(value);
  if ((method === 'GET' && acceptedBody) || acceptedBody?.length > 65_536) throw createProviderRequestError(provider, 'request_rejected');
  return { provider, url: destination, method, headers: acceptedHeaders, body: acceptedBody, fetchBody: typeof value === 'string' ? value : acceptedBody, maxBytes, timeoutMs, empty };
}
export const hasProviderProxy = env => ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'].some(key => Boolean(env[key]?.trim()));
