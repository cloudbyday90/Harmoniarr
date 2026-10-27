/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from './api-error.js';
import { hashPassword, verifyPassword, hashToken } from './security.js';
import { validatePassword } from './validators/auth-validator.js';
import { isCurrentPasswordHash } from './password-hash-policy.js';
import { startAuthLookup } from './auth-lookup-service.js';
import { selectSessionAuditMetadata } from './session-audit-metadata.js';
import { createSessionMaterial } from './session-issuance-policy.js';
import { startSessionWriteTransaction } from './session-write-transaction-service.js';
import { lockSessionFamily } from './session-family-lock-store.js';
import { lockRotationParent, assertRotationNotExpired } from './session-issuance-store.js';
import { publishOwnedRootSession } from './session-root-publication-service.js';
import { recordAuditEvent } from './audit.js';
import { findPasswordChangeUser, lockPasswordChangeUser, replacePasswordChangeCredential, revokePasswordChangeSessions } from './password-change-store.js';

const authRequired = () => createApiError(401, 'auth_required', 'Authentication is required');
const invalidPassword = () => createApiError(401, 'current_password_invalid', 'Current password is incorrect');
const readUser = (id, options) => startAuthLookup(client => findPasswordChangeUser(client, id), options).result;

export function createPasswordChangeService({ readUserFn = readUser, verifyPasswordFn = verifyPassword,
  hashPasswordFn = hashPassword, validatePasswordFn = validatePassword, createMaterialFn = createSessionMaterial,
  startTransactionFn = startSessionWriteTransaction, recordAuditEventFn = recordAuditEvent } = {}) {
  return { async changePassword({ currentPassword, newPassword, requestMetadata, session, signal }) {
    const identity = { appUserId: session?.appUserId, refreshTokenId: session?.refreshTokenId, tokenFamilyId: session?.tokenFamilyId,
      tokenHash: typeof session?.refreshToken === 'string' && session.refreshToken ? hashToken(session.refreshToken) : null };
    if (!identity.tokenHash || ![identity.appUserId, identity.refreshTokenId, identity.tokenFamilyId].every(value => typeof value === 'string' && value)) throw authRequired();
    const metadata = selectSessionAuditMetadata(requestMetadata);
    const validatedCurrent = validatePasswordFn(currentPassword), validatedNew = validatePasswordFn(newPassword);
    const user = await readUserFn(identity.appUserId, { signal });
    if (!user || user.is_disabled) throw authRequired();
    const accepted = { id: user.id, password_hash: user.password_hash, credential_epoch: user.credential_epoch };
    if (!await verifyPasswordFn(validatedCurrent, accepted.password_hash)) throw invalidPassword();
    if (await verifyPasswordFn(validatedNew, accepted.password_hash)) throw createApiError(400, 'validation_error', 'New password must be different from the current password');
    const passwordHash = await hashPasswordFn(validatedNew);
    if (!isCurrentPasswordHash(passwordHash)) throw createApiError(503, 'password_work_unavailable', 'Password verification is temporarily unavailable. Try again.');
    const material = createMaterialFn();
    const result = await startTransactionFn(async (client, check) => {
      const current = await lockPasswordChangeUser(client, accepted.id); check();
      if (!current || current.is_disabled) return { refusal: 'auth_required' };
      if (current.password_hash !== accepted.password_hash || current.credential_epoch !== accepted.credential_epoch) return { refusal: 'current_password_invalid' };
      await lockSessionFamily(client, identity.tokenFamilyId); check();
      const parent = await lockRotationParent(client, { ...identity, passwordChangedAt: current.credential_epoch }); check();
      if (!parent || parent.is_revoked || parent.replaced_by_refresh_token_id || !parent.unexpired || !parent.current_password) return { refusal: 'auth_required' };
      const owner = await replacePasswordChangeCredential(client, accepted, passwordHash); check();
      const revokedSessionCount = await revokePasswordChangeSessions(client, accepted.id); check();
      const issuedSession = await publishOwnedRootSession(client, { owner, material, metadata }, check);
      await recordAuditEventFn({ actorUserId: owner.id, actorType: 'user', eventType: 'password_changed',
        summary: 'User password changed', entityType: 'app_user', entityId: owner.id,
        details: { revokedSessionCount }, ...metadata }, client); check();
      await assertRotationNotExpired(client, identity.refreshTokenId); check();
      return { user: owner, issuedSession };
    }).result;
    if (result.refusal) throw result.refusal === 'current_password_invalid' ? invalidPassword() : authRequired();
    return result;
  } };
}
