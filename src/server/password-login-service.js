/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from './api-error.js';
import { verifyPassword } from './security.js';
import { normalizeLoginIdentifier, validatePassword } from './validators/auth-validator.js';
import { selectSessionAuditMetadata } from './session-audit-metadata.js';
import { createSessionMaterial } from './session-issuance-policy.js';
import { startSessionWriteTransaction } from './session-write-transaction-service.js';
import { publishOwnedRootSession } from './session-root-publication-service.js';
import { recordAuditEvent } from './audit.js';
import { findPasswordLoginUser, lockPasswordLoginUser, recordSuccessfulPasswordLogin } from './password-login-store.js';

const invalidCredentials = () => createApiError(401, 'invalid_credentials', 'Username or email and password combination is incorrect');
const accountLocked = () => createApiError(423, 'account_locked', 'Account is temporarily locked after repeated failed logins');

export function createPasswordLoginService({ isBootstrapRequiredFn, handleLoginFailureFn,
  findUserFn = findPasswordLoginUser, verifyPasswordFn = verifyPassword,
  startTransactionFn = startSessionWriteTransaction, recordAuditEventFn = recordAuditEvent,
  createMaterialFn = createSessionMaterial } = {}) {
  return { async loginUser({ username, password, requestMetadata }) {
    const metadata = selectSessionAuditMetadata(requestMetadata);
    if (await isBootstrapRequiredFn()) throw createApiError(409, 'bootstrap_required', 'Create the bootstrap admin account before logging in');
    const identifier = normalizeLoginIdentifier(username), validatedPassword = validatePassword(password);
    const user = await findUserFn(identifier);
    if (!user || user.is_disabled) {
      await handleLoginFailureFn(user, metadata, identifier);
      throw invalidCredentials();
    }
    if (user.login_locked) throw accountLocked();
    const accepted = { id: user.id, hash: user.password_hash, epoch: user.credential_epoch };
    if (!await verifyPasswordFn(validatedPassword, accepted.hash)) {
      await handleLoginFailureFn(user, metadata, identifier);
      throw invalidCredentials();
    }
    const material = createMaterialFn();
    const result = await startTransactionFn(async (client, check) => {
      const current = await lockPasswordLoginUser(client, accepted.id); check();
      if (!current || current.is_disabled || current.password_hash !== accepted.hash || current.credential_epoch !== accepted.epoch) return { refusal: 'invalid_credentials' };
      if (current.login_locked) return { refusal: 'account_locked' };
      const owner = await recordSuccessfulPasswordLogin(client, accepted.id); check();
      const issuedSession = await publishOwnedRootSession(client, { owner, material, metadata }, check);
      await recordAuditEventFn({ actorUserId: owner.id, actorType: 'user', eventType: 'login_succeeded',
        summary: 'User login succeeded', entityType: 'app_user', entityId: owner.id, ...metadata }, client); check();
      return { user: owner, issuedSession };
    }).result;
    if (result.refusal) throw result.refusal === 'account_locked' ? accountLocked() : invalidCredentials();
    return result;
  } };
}
