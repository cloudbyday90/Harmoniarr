/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from './api-error.js';
import { hashToken } from './security.js';
import { recordAuditEvent } from './audit.js';
import { startSessionWriteTransaction } from './session-write-transaction-service.js';
import { lockSessionOwner, lockSessionFamily } from './session-family-lock-store.js';
import { selectSessionAuditMetadata } from './session-audit-metadata.js';
import { createSessionMaterial, toIssuedSession } from './session-issuance-policy.js';
import { toSessionUser } from './session-user-policy.js';
import { applySessionReplay } from './session-replay-service.js';
import { lockRotationParent, insertSessionToken, replaceSessionParent, assertRotationNotExpired } from './session-issuance-store.js';

function publish(result) {
  if (result.refusal === 'reauth_required') throw createApiError(403, 'reauth_required', 'Re-authentication is required before continuing');
  if (result.refusal) throw createApiError(401, 'auth_required', 'Authentication is required');
  return result.issuedSession;
}

export function createSessionIssuanceService({ startTransactionFn = startSessionWriteTransaction,
  createMaterialFn = createSessionMaterial, recordAuditEventFn = recordAuditEvent, applyReplayFn = applySessionReplay } = {}) {
  async function issueRootSession(input) {
    if (input.parentRefreshTokenId != null || input.tokenFamilyId != null) throw new TypeError('Root issuance cannot select an existing session family');
    const userId = input.userId, metadata = selectSessionAuditMetadata(input.requestMetadata), material = createMaterialFn();
    return publish(await startTransactionFn(async (client, check) => {
      const owner = await lockSessionOwner(client, userId); check();
      if (!owner || owner.is_disabled) return { refusal: 'auth_required' };
      await lockSessionFamily(client, material.tokenFamilyId); check();
      const id = await insertSessionToken(client, { userId, material, metadata });
      return { issuedSession: toIssuedSession(material, id, toSessionUser(owner)) };
    }).result);
  }

  async function rotateSession(session, requestMetadata) {
    const identity = { refreshTokenId: session.refreshTokenId, appUserId: session.appUserId, tokenFamilyId: session.tokenFamilyId,
      tokenHash: typeof session.refreshToken === 'string' ? hashToken(session.refreshToken) : null };
    const metadata = selectSessionAuditMetadata(requestMetadata), material = createMaterialFn(identity.tokenFamilyId);
    return publish(await startTransactionFn(async (client, check) => {
      const owner = await lockSessionOwner(client, identity.appUserId); check();
      if (!owner || owner.is_disabled || !identity.tokenHash) return { refusal: 'auth_required' };
      if (owner.must_change_password) return { refusal: 'reauth_required' };
      await lockSessionFamily(client, identity.tokenFamilyId); check();
      const parent = await lockRotationParent(client, { ...identity, passwordChangedAt: owner.password_changed_at }); check();
      if (!parent || !parent.unexpired || !parent.current_password) return { refusal: 'auth_required' };
      if (parent.is_revoked) {
        if (parent.replaced_by_refresh_token_id) await applyReplayFn(client, identity, metadata, check);
        return { refusal: 'auth_required' };
      }
      if (parent.replaced_by_refresh_token_id) throw new Error('Active session has an unexpected replacement');
      const childId = await insertSessionToken(client, { userId: identity.appUserId, parentRefreshTokenId: identity.refreshTokenId, material, metadata }); check();
      await replaceSessionParent(client, { identity, childId }); check();
      await recordAuditEventFn({ actorUserId: identity.appUserId, actorType: 'user', eventType: 'session_rotated',
        summary: 'Session refreshed', entityType: 'refresh_token', entityId: identity.refreshTokenId,
        details: { tokenFamilyId: identity.tokenFamilyId, replacementSessionId: childId }, ...metadata }, client); check();
      await assertRotationNotExpired(client, identity.refreshTokenId);
      return { issuedSession: toIssuedSession(material, childId, toSessionUser(owner)) };
    }).result);
  }
  return { issueRootSession, rotateSession };
}
