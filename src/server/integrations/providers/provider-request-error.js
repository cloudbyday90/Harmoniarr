/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

const labels = { spotify: 'Spotify', youtube: 'YouTube', apple_music: 'Apple Music' };
const reasons = new Set(['QUOTA_EXCEEDED', 'quotaExceeded', 'dailyLimitExceeded', 'rateLimitExceeded', 'userRateLimitExceeded', 'keyInvalid', 'accessNotConfigured', 'insufficientPermissions', 'playlistItemsNotAccessible', 'forbidden', 'playlistNotFound', 'invalid_client', 'invalid_grant', 'invalid_token']);

export function createProviderRequestError(provider, kind, { status = null, reasonCode = null, retryAfterSeconds = null, oauth = false } = {}) {
  const suffixes = { credentials_rejected: 'unauthorized', access_denied: 'forbidden', resource_unavailable: 'not_found',
    rate_limited: 'rate_limited', quota_exceeded: 'quota_exceeded', response_invalid: 'invalid_response', timeout: 'timeout', unavailable: 'unavailable',
    configuration_required: 'misconfigured', request_rejected: 'request_failed', request_budget_exceeded: 'request_budget_exceeded' };
  if (!Object.hasOwn(suffixes, kind)) kind = 'unavailable';
  const error = new Error(`${labels[provider] ?? 'Provider'} request could not be completed (${kind}).`);
  error.code = oauth ? `${provider}_oauth_token_exchange_failed` : `${provider}_${suffixes[kind] ?? 'request_failed'}`;
  error.diagnosticCode = kind;
  error.details = { status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null,
    reasonCode: reasons.has(reasonCode) ? reasonCode : null,
    retryAfterSeconds: Number.isSafeInteger(retryAfterSeconds) && retryAfterSeconds >= 0 ? Math.min(86400, retryAfterSeconds) : null };
  return error;
}

export function parseProviderRetryAfter(value, now = Date.now()) {
  if (typeof value !== 'string' || value.length > 100) return null;
  const trimmed = value.trim();
  const seconds = /^\d+$/.test(trimmed) ? Number(trimmed) : (Date.parse(trimmed) - now) / 1000;
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(86400, Math.ceil(seconds)) : null;
}

export function classifyProviderHttpError({ provider, status, body, retryAfterSeconds, oauth = false }) {
  const candidate = typeof body?.error === 'string' ? body.error : provider === 'youtube' ? body?.error?.errors?.[0]?.reason : body?.error?.reason;
  const reasonCode = reasons.has(candidate) ? candidate : null;
  let kind = 'request_rejected';
  if (status === 401 || ['invalid_client', 'invalid_grant', 'invalid_token', 'keyInvalid'].includes(reasonCode)) kind = 'credentials_rejected';
  else if (['QUOTA_EXCEEDED', 'quotaExceeded', 'dailyLimitExceeded'].includes(reasonCode)) kind = 'quota_exceeded';
  else if (status === 429 || ['rateLimitExceeded', 'userRateLimitExceeded'].includes(reasonCode)) kind = 'rate_limited';
  else if (status === 403) kind = 'access_denied';
  else if (status === 404) kind = 'resource_unavailable';
  else if (status >= 500) kind = 'unavailable';
  return createProviderRequestError(provider, kind, { status, reasonCode, retryAfterSeconds, oauth });
}
