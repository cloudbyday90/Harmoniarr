/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from '../../api-error.js';

export const plexRequestTimeoutMs = 15_000;
export const plexMaxActiveRequests = 4;
export const plexMaxHeaderBytes = 16_384;
const operations = Object.freeze({
  createPin: { bytes: 65_536, invalid: 'plex_pin_invalid_response', unauthorized: 'plex_pin_unauthorized', failed: 'plex_pin_create_failed' },
  readPin: { bytes: 65_536, invalid: 'plex_pin_invalid_response', unauthorized: 'plex_pin_unauthorized', failed: 'plex_pin_read_failed' },
  user: { bytes: 262_144, invalid: 'plex_user_invalid_response', unauthorized: 'plex_token_invalid', failed: 'plex_user_fetch_failed' },
  home: { bytes: 1_048_576, invalid: 'plex_home_users_invalid_response', unauthorized: 'plex_token_invalid', failed: 'plex_home_users_fetch_failed', collection: true },
  resources: { bytes: 2_097_152, invalid: 'plex_resources_invalid_response', unauthorized: 'plex_token_invalid', failed: 'plex_resources_fetch_failed', collection: true },
});
const failures = Object.freeze({ timeout: [504, 'Plex request exceeded its time limit'], busy: [503, 'Plex requests are temporarily busy'],
  closed: [503, 'Plex requests are temporarily unavailable'], unavailable: [502, 'Plex request could not be completed'],
  oversized: [502, 'Plex response exceeded its size limit'], redirect: [502, 'Plex returned an unsupported redirect'],
  invalid: [502, 'Plex returned an invalid response'] });
export function plexHttpError(reason) {
  const [status, message] = failures[reason] ?? failures.unavailable;
  return createApiError(status, `plex_request_${Object.hasOwn(failures, reason) ? reason : 'unavailable'}`, message);
}
export function plexOperationPolicy(operation) {
  if (!Object.hasOwn(operations, operation)) throw plexHttpError('invalid');
  return operations[operation];
}
export function admitPlexDestination(value) {
  let url;
  try { url = new URL(value); } catch { throw plexHttpError('invalid'); }
  if (!['https://plex.tv', 'https://clients.plex.tv'].includes(url.origin) || url.username || url.password || url.hash || url.port) throw plexHttpError('invalid');
  return url;
}
export function validatePlexHeaders({ clientIdentifier, accessToken }) {
  const safe = (value, limit) => typeof value === 'string' && value.length > 0 && value.length <= limit
    && [...value].every(character => character.charCodeAt(0) >= 33 && character.charCodeAt(0) <= 126);
  if (!safe(clientIdentifier, 256) || (accessToken != null && !safe(accessToken, 4096))) throw plexHttpError('invalid');
  return { Accept: 'application/json', 'Accept-Encoding': 'identity', 'X-Plex-Client-Identifier': clientIdentifier,
    'X-Plex-Product': 'Harmoniarr', ...(accessToken ? { 'X-Plex-Token': accessToken } : {}) };
}
export function validatePlexResponseHeaders(status, headers, maxBytes) {
  if (!Number.isInteger(status) || status < 100 || status > 599) throw plexHttpError('invalid');
  if (status >= 300 && status < 400) throw plexHttpError('redirect');
  if (status < 200 || status >= 300) return;
  const encoding = headers.get('content-encoding')?.trim().toLowerCase();
  if (encoding && encoding !== 'identity') throw plexHttpError('invalid');
  if (!/^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)(?:\s*;|$)/iu.test(headers.get('content-type') ?? '')) throw plexHttpError('invalid');
  const length = headers.get('content-length');
  if (length !== null && (!/^\d+$/u.test(length) || !Number.isSafeInteger(Number(length)) || Number(length) > maxBytes)) throw plexHttpError('oversized');
}
export function decodePlexResponse({ status, headers, body }, operation) {
  const policy = plexOperationPolicy(operation);
  validatePlexResponseHeaders(status, headers, policy.bytes);
  if (status < 200 || status >= 300) throw createApiError(status === 401 ? 401 : 502,
    status === 401 ? policy.unauthorized : policy.failed, status === 401 ? 'Plex authentication was refused' : 'Plex request was refused');
  try {
    if (!Buffer.isBuffer(body) || body.length > policy.bytes) throw new Error();
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
    if (!value || typeof value !== 'object' || (!policy.collection && Array.isArray(value))) throw new Error();
    return value;
  } catch { throw createApiError(502, policy.invalid, 'Plex returned an invalid JSON payload'); }
}
