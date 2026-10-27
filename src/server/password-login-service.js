/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from './api-error.js';
import { hashPassword, verifyPassword } from './security.js';
import { currentPasswordHashProfile, isCurrentPasswordHash, needsPasswordHashUpgrade } from './password-hash-policy.js';
import { normalizeLoginIdentifier, validatePassword } from './validators/auth-validator.js';
import { selectSessionAuditMetadata } from './session-audit-metadata.js';
import { createSessionMaterial } from './session-issuance-policy.js';
import { startSessionWriteTransaction } from './session-write-transaction-service.js';
import { publishOwnedRootSession } from './session-root-publication-service.js';
import { recordAuditEvent } from './audit.js';
import { lockPasswordLoginUser, upgradePasswordLoginHash } from './password-login-store.js';
import { recordSuccessfulLogin } from './login-bookkeeping-store.js';
import { readPasswordLoginUser } from './auth-lookup-service.js';

const invalidCredentials = () => createApiError(401, 'invalid_credentials', 'Username or email and password combination is incorrect');
const accountLocked = () => createApiError(423, 'account_locked', 'Account is temporarily locked after repeated failed logins');

export function createPasswordLoginService({ isBootstrapRequiredFn, handleLoginFailureFn,
  findUserFn = readPasswordLoginUser, verifyPasswordFn = verifyPassword, hashPasswordFn = hashPassword,
  startTransactionFn = startSessionWriteTransaction, recordAuditEventFn = recordAuditEvent,
  createMaterialFn = createSessionMaterial } = {}) {
  return { async loginUser({ username, password, requestMetadata, signal }) {
    const metadata = selectSessionAuditMetadata(requestMetadata);
    if (await isBootstrapRequiredFn({ signal })) throw createApiError(409, 'bootstrap_required', 'Create the bootstrap admin account before logging in');
    const identifier = normalizeLoginIdentifier(username), validatedPassword = validatePassword(password);
    const user = await findUserFn(identifier, { signal });
    const accepted = user ? { id: user.id, password_hash: user.password_hash, credential_epoch: user.credential_epoch } : null;
    if (!user || user.is_disabled) {
      await handleLoginFailureFn(accepted, metadata, identifier, { countFailure: false });
      throw invalidCredentials();
    }
    if (user.login_locked) {
      await handleLoginFailureFn(accepted, metadata, identifier, { countFailure: false });
      throw accountLocked();
    }
    if (!await verifyPasswordFn(validatedPassword, accepted.password_hash)) {
      await handleLoginFailureFn(accepted, metadata, identifier);
      throw invalidCredentials();
    }
    // Derive outside the write owner; its lock then fences the verified source.
    const upgrade = needsPasswordHashUpgrade(accepted.password_hash);
    const replacement = upgrade ? await hashPasswordFn(validatedPassword) : null;
    if (upgrade && !isCurrentPasswordHash(replacement)) throw createApiError(503, 'password_work_unavailable', 'Password verification is temporarily unavailable. Try again.');
    const material = createMaterialFn();
    const result = await startTransactionFn(async (client, check) => {
      const current = await lockPasswordLoginUser(client, accepted.id); check();
      if (!current || current.is_disabled || current.password_hash !== accepted.password_hash || current.credential_epoch !== accepted.credential_epoch) return { refusal: 'invalid_credentials' };
      if (current.login_locked) return { refusal: 'account_locked' };
      if (replacement !== null) { await upgradePasswordLoginHash(client, accepted, replacement); check(); }
      const owner = await recordSuccessfulLogin(client, accepted.id); check();
      const issuedSession = await publishOwnedRootSession(client, { owner, material, metadata }, check);
      await recordAuditEventFn({ actorUserId: owner.id, actorType: 'user', eventType: 'login_succeeded',
        summary: 'User login succeeded', entityType: 'app_user', entityId: owner.id, ...metadata,
        ...(replacement !== null ? { details: { passwordHashUpgraded: true, passwordHashProfile: currentPasswordHashProfile.id } } : {}) }, client); check();
      return { user: owner, issuedSession };
    }).result;
    if (result.refusal) {
      await handleLoginFailureFn(accepted, metadata, identifier, { countFailure: false });
      throw result.refusal === 'account_locked' ? accountLocked() : invalidCredentials();
    }
    return result;
  } };
}
