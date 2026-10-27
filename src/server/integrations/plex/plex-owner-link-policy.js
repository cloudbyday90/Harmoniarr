/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createHash } from 'node:crypto';
import { createApiError } from '../../api-error.js';
import { hashToken } from '../../security.js';
import { isPlexCallbackState, hashPlexBrowserBinding, parsePlexPendingState, plexCallbackMaxCiphertextBytes } from './plex-callback-policy.js';

export const ownerLinkSecretType = 'integration_oauth';
export const ownerLinkPrefix = 'providers.plex.link.pending.';
export const ownerLinkTokenName = 'providers.plex.link.token';
export const ownerLinkClientName = 'providers.plex.link.client_identifier';
export const ownerLinkRevisionName = 'providers.plex.link.revision';
export const ownerLinkLockKey = createHash('sha256').update('harmoniarr:plex-owner-link:v1').digest().readBigInt64BE().toString();
export const invalidOwnerLink = () => createApiError(400, 'plex_link_state_invalid', 'Plex linking expired or changed. Start linking again in this browser.');
export const ownerLinkForbidden = () => createApiError(403, 'plex_link_authorization_changed', 'A current administrator session is required. Start linking again.');
export function ownerLinkStateName(state) {
  if (!isPlexCallbackState(state)) throw invalidOwnerLink();
  return ownerLinkPrefix + state;
}
export function captureOwnerLinkAuthority(value) {
  if (!value || !['appUserId', 'refreshTokenId', 'tokenFamilyId'].every(key => isPlexCallbackState(value[key]))
    || typeof value.tokenHash !== 'string' || !/^[a-f0-9]{64}$/u.test(value.tokenHash)) throw ownerLinkForbidden();
  return { appUserId: value.appUserId, refreshTokenId: value.refreshTokenId, tokenFamilyId: value.tokenFamilyId, tokenHash: value.tokenHash };
}
export function ownerLinkSessionAuthority(session) {
  if (typeof session?.refreshToken !== 'string' || !session.refreshToken || session.refreshToken.length > 256) throw ownerLinkForbidden();
  return captureOwnerLinkAuthority({ ...session, tokenHash: hashToken(session.refreshToken) });
}
export function parseOwnerLinkPending(plaintext, browserBinding, observedAt) {
  try {
    const common = parsePlexPendingState(plaintext, browserBinding, observedAt), value = JSON.parse(plaintext);
    if (value.kind !== 'owner_link' || !isPlexCallbackState(value.linkRevision)) throw invalidOwnerLink();
    return { clientIdentifier: common.clientIdentifier, pinId: common.pinId, expiresAt: common.expiresAt,
      authority: captureOwnerLinkAuthority(value.authority), linkRevision: value.linkRevision };
  } catch { throw invalidOwnerLink(); }
}
export function captureOwnerLinkProof(value) {
  if (!value || !isPlexCallbackState(value.id) || typeof value.name !== 'string' || !value.name.startsWith(ownerLinkPrefix)
    || !isPlexCallbackState(value.name.slice(ownerLinkPrefix.length)) || !Buffer.isBuffer(value.encryptedValue)
    || !value.encryptedValue.length || value.encryptedValue.length > plexCallbackMaxCiphertextBytes
    || typeof value.revision !== 'string' || !value.revision || value.revision.length > 64
    || typeof value.expiresAt !== 'string' || !Number.isFinite(Date.parse(value.expiresAt))
    || new Date(value.expiresAt).toISOString() !== value.expiresAt) throw invalidOwnerLink();
  return { id: value.id, name: value.name, encryptedValue: Buffer.from(value.encryptedValue), revision: value.revision, expiresAt: value.expiresAt };
}
export function ownerLinkBindingHash(value) {
  try { return hashPlexBrowserBinding(value); } catch { throw invalidOwnerLink(); }
}
export function normalizeOwnerLinkProfile(profile) {
  if (profile?.restricted === true || profile?.guest === true) throw createApiError(403, 'plex_link_restricted_account', 'A managed or restricted Plex account cannot be linked as owner');
  const text = (value, limit) => typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null;
  const rawId = typeof profile?.id === 'string' || (typeof profile?.id === 'number' && Number.isSafeInteger(profile.id)) ? String(profile.id) : null;
  const id = text(rawId, 256), uuid = text(profile?.uuid, 256);
  if ((!id && !uuid) || (profile?.uuid && profile.uuid.length > 256) || (profile?.id != null && String(profile.id).length > 256)) throw createApiError(502, 'plex_link_profile_invalid', 'Plex returned an unusable owner identity');
  return { id, uuid, email: text(profile.email, 254)?.toLowerCase() ?? null, title: text(profile.title, 256) ?? text(profile.username, 256) ?? 'Plex account',
    username: text(profile.username, 256)?.toLowerCase() ?? null, thumbUrl: text(profile.thumb, 2048) };
}
