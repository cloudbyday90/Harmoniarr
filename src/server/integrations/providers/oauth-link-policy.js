/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { createApiError } from '../../api-error.js';
import { hashToken } from '../../security.js';

export const oauthSecretType = 'integration_oauth';
export const oauthCipherLimit = 16 * 1024;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u;
const digest = value => createHash('sha256').update(value).digest('hex');
export function oauthLinkNames(provider) {
  if (!['spotify', 'youtube'].includes(provider)) throw new TypeError('Unsupported OAuth provider');
  const prefix = `providers.${provider}.oauth.`;
  return { provider, token: prefix + 'token', revision: prefix + 'revision', pending: prefix + 'pending.',
    lockKey: createHash('sha256').update('harmoniarr:oauth-link:v1\0' + provider).digest().readBigInt64BE().toString() };
}
export const invalidOAuthState = provider => createApiError(400, `${provider}_oauth_state_invalid`, 'Provider linking expired or changed. Start linking again in this browser.');
export const changedOAuthAuthority = provider => createApiError(403, `${provider}_oauth_authorization_changed`, 'A current administrator session is required. Start linking again.');
export const changedOAuthLink = provider => createApiError(409, `${provider}_oauth_link_changed`, 'Provider linking changed. Try again.');
export const isOAuthState = value => typeof value === 'string' && /^[A-Za-z0-9_-]{32}$/u.test(value);
export const isOAuthRevision = value => typeof value === 'string' && uuid.test(value);
export const isOAuthBinding = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/u.test(value) && Buffer.from(value, 'base64url').toString('base64url') === value;
export function isOAuthRedirectUri(provider, value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash || url.search) return false;
    return url.protocol === 'https:' || (url.protocol === 'http:'
      && (['127.0.0.1', '[::1]'].includes(url.hostname) || (provider === 'youtube' && url.hostname === 'localhost')));
  } catch { return false; }
}
export function oauthBindingHash(provider, value) {
  oauthLinkNames(provider);
  if (!isOAuthBinding(value)) throw invalidOAuthState(provider);
  return digest('harmoniarr:oauth-browser:v1\0' + provider + '\0' + value);
}
export function captureOAuthAuthority(provider, value) {
  if (!value || !['appUserId', 'refreshTokenId', 'tokenFamilyId'].every(key => typeof value[key] === 'string' && uuid.test(value[key]))
    || typeof value.tokenHash !== 'string' || !/^[a-f0-9]{64}$/u.test(value.tokenHash)) throw changedOAuthAuthority(provider);
  return { appUserId: value.appUserId, refreshTokenId: value.refreshTokenId, tokenFamilyId: value.tokenFamilyId, tokenHash: value.tokenHash };
}
export function oauthSessionAuthority(provider, session) {
  if (typeof session?.refreshToken !== 'string' || !session.refreshToken || session.refreshToken.length > 256) throw changedOAuthAuthority(provider);
  return captureOAuthAuthority(provider, { ...session, tokenHash: hashToken(session.refreshToken) });
}
export function oauthCredentialsFingerprint(provider, credentials) {
  if (typeof credentials?.clientId !== 'string' || !credentials.clientId || credentials.clientId.length > 1024) throw invalidOAuthState(provider);
  const entries = value => Object.entries(value ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return digest(JSON.stringify([provider, credentials.clientId, entries(credentials.extraTokenParams), entries(credentials.extraRefreshParams)]));
}
export function captureOAuthProof(provider, value) {
  const names = oauthLinkNames(provider);
  if (!value || !uuid.test(value.id ?? '') || typeof value.name !== 'string'
    || !(value.name === names.token || (value.name.startsWith(names.pending) && isOAuthState(value.name.slice(names.pending.length))))
    || !Buffer.isBuffer(value.encryptedValue) || !value.encryptedValue.length || value.encryptedValue.length > oauthCipherLimit
    || typeof value.revision !== 'string' || !value.revision || value.revision.length > 64) throw invalidOAuthState(provider);
  return { id: value.id, name: value.name, encryptedValue: Buffer.from(value.encryptedValue), revision: value.revision };
}
export function parseOAuthPending(provider, plaintext, browserBinding, observedAt) {
  const hash = oauthBindingHash(provider, browserBinding);
  try {
    if (typeof plaintext !== 'string' || Buffer.byteLength(plaintext, 'utf8') > 8192) throw invalidOAuthState(provider);
    const value = JSON.parse(plaintext), expires = Date.parse(value?.expiresAt), observed = new Date(observedAt ?? NaN).getTime();
    if (value?.version !== 1 || value.kind !== 'provider_oauth' || value.provider !== provider
      || !Number.isFinite(expires) || !Number.isFinite(observed) || expires <= observed || new Date(expires).toISOString() !== value.expiresAt
      || !isOAuthRevision(value.linkRevision) || !/^[a-f0-9]{64}$/u.test(value.credentialFingerprint ?? '')
      || !/^[A-Za-z0-9_-]{43,128}$/u.test(value.codeVerifier ?? '')
      || typeof value.redirectUri !== 'string' || value.redirectUri.length > 2048
      || typeof value.browserBindingHash !== 'string' || !/^[a-f0-9]{64}$/u.test(value.browserBindingHash)
      || !timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(value.browserBindingHash, 'hex'))) throw invalidOAuthState(provider);
    if (!isOAuthRedirectUri(provider, value.redirectUri)) throw invalidOAuthState(provider);
    return { authority: captureOAuthAuthority(provider, value.authority), linkRevision: value.linkRevision, credentialFingerprint: value.credentialFingerprint,
      codeVerifier: value.codeVerifier, redirectUri: value.redirectUri, expiresAt: value.expiresAt };
  } catch { throw invalidOAuthState(provider); }
}
export function captureOAuthToken(provider, value) {
  const text = (candidate, limit, required = false) => typeof candidate === 'string' && candidate.length <= limit && (!required || candidate.length > 0);
  if (!text(value?.accessToken, 4096, true) || !(value.refreshToken == null || text(value.refreshToken, 4096, true))
    || !(value.scope == null || text(value.scope, 2048)) || !text(value.tokenType ?? 'Bearer', 64, true)
    || typeof value.expiresAt !== 'string' || value.expiresAt.length > 64 || !Number.isFinite(Date.parse(value.expiresAt))) throw invalidOAuthState(provider);
  return { accessToken: value.accessToken, refreshToken: value.refreshToken ?? null, scope: value.scope ?? null,
    tokenType: value.tokenType ?? 'Bearer', expiresAt: value.expiresAt };
}
