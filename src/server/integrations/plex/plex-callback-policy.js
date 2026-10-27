/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { createApiError } from '../../api-error.js';

export const plexCallbackSecretType = 'integration_oauth';
export const plexCallbackPrefix = 'auth.plex.sign_in.pending.';
export const plexClientIdentifierName = 'auth.plex.sign_in.client_identifier';
export const plexCallbackLifetimeSeconds = 600;
export const plexCallbackMaxCiphertextBytes = 16 * 1024;
export const plexClientIdentifierLockKey = createHash('sha256').update('harmoniarr:plex-client-identifier:v1').digest().readBigInt64BE().toString();
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;

export const invalidPlexCallback = () => createApiError(400, 'plex_sign_in_state_invalid', 'Plex sign-in expired or is not valid for this browser. Start sign-in again.');
export const isPlexCallbackState = value => typeof value === 'string' && uuid.test(value);
export const plexCallbackSecretName = state => {
  if (!isPlexCallbackState(state)) throw invalidPlexCallback();
  return plexCallbackPrefix + state;
};
export function isPlexBrowserBinding(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/u.test(value) && Buffer.from(value, 'base64url').toString('base64url') === value;
}
export function hashPlexBrowserBinding(value) {
  if (!isPlexBrowserBinding(value)) throw invalidPlexCallback();
  return createHash('sha256').update('harmoniarr:plex-browser:v1\0' + value).digest('hex');
}

export function normalizePlexRedirect(value) {
  if (typeof value !== 'string' || value.length > 2048) return '/app';
  const target = value.trim();
  if (!target.startsWith('/') || target.startsWith('//') || unsafeContinuation(target)) return '/app';
  try {
    const url = new URL(target, 'https://harmoniarr.invalid');
    if (url.origin !== 'https://harmoniarr.invalid' || /%(?:2f|5c)/iu.test(url.pathname)
      || (url.pathname !== '/app' && !url.pathname.startsWith('/app/'))
      || unsafeContinuation(decodeURIComponent(url.pathname))) return '/app';
    return url.pathname + url.search + url.hash;
  } catch { return '/app'; }
}
const unsafeContinuation = value => [...value].some(character => character === '\\' || character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127);

export function parsePlexPendingState(plaintext, browserBinding, observedAt) {
  const bindingHash = hashPlexBrowserBinding(browserBinding);
  if (typeof plaintext !== 'string' || plaintext.length > 4096 || Buffer.byteLength(plaintext, 'utf8') > 4096) throw invalidPlexCallback();
  let value;
  try { value = JSON.parse(plaintext); } catch { throw invalidPlexCallback(); }
  const expires = Date.parse(value?.expiresAt), observed = observedAt == null ? NaN : new Date(observedAt).getTime();
  if (value?.version !== 1 || !Number.isFinite(expires) || !Number.isFinite(observed) || expires <= observed
    || new Date(expires).toISOString() !== value.expiresAt
    || !['clientIdentifier', 'pinId'].every(key => typeof value[key] === 'string' && value[key].length > 0 && value[key].length <= 256)
    || typeof value.browserBindingHash !== 'string' || !/^[a-f0-9]{64}$/u.test(value.browserBindingHash)
    || !timingSafeEqual(Buffer.from(value.browserBindingHash, 'hex'), Buffer.from(bindingHash, 'hex'))) throw invalidPlexCallback();
  return { clientIdentifier: value.clientIdentifier, pinId: value.pinId, expiresAt: value.expiresAt, redirectTo: normalizePlexRedirect(value.redirectTo) };
}

export function capturePlexCallbackProof(value) {
  if (!value || typeof value.id !== 'string' || !uuid.test(value.id)
    || typeof value.name !== 'string' || !value.name.startsWith(plexCallbackPrefix) || !isPlexCallbackState(value.name.slice(plexCallbackPrefix.length))
    || !Buffer.isBuffer(value.encryptedValue) || !value.encryptedValue.length || value.encryptedValue.length > plexCallbackMaxCiphertextBytes
    || typeof value.revision !== 'string' || !value.revision || value.revision.length > 64
    || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))
    || new Date(value.expiresAt).toISOString() !== value.expiresAt) throw invalidPlexCallback();
  return { id: value.id, name: value.name, encryptedValue: Buffer.from(value.encryptedValue), revision: value.revision, expiresAt: value.expiresAt };
}
