/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { normalizeLoginIdentifier } from './validators/auth-validator.js';
import { selectSessionAuditMetadata } from './session-audit-metadata.js';
import { startSessionWriteTransaction } from './session-write-transaction-service.js';
import { lockPasswordLoginUser } from './password-login-store.js';
import { incrementLoginFailure } from './login-failure-store.js';
import { recordAuditEvent } from './audit.js';

const startFailureTransaction = work => startSessionWriteTransaction(work, { errorCode: 'login_failure_unavailable' });

export function createLoginFailureService({ startTransactionFn = startFailureTransaction,
  recordAuditEventFn = recordAuditEvent } = {}) {
  return { async handleLoginFailure(user, requestMetadata, identifier, { countFailure = true } = {}) {
    const accepted = user ? { id: user.id, hash: user.password_hash, epoch: user.credential_epoch } : null;
    const username = normalizeLoginIdentifier(identifier).slice(0, 320);
    const metadata = selectSessionAuditMetadata(requestMetadata);
    if (metadata.userAgent !== null) metadata.userAgent = metadata.userAgent.slice(0, 512);
    await startTransactionFn(async (client, check) => {
      let outcome = 'unknown_account';
      if (accepted) {
        const current = await lockPasswordLoginUser(client, accepted.id); check();
        if (!current || current.is_disabled) outcome = 'account_unavailable';
        else if (current.password_hash !== accepted.hash || current.credential_epoch !== accepted.epoch) outcome = 'stale_credentials';
        else if (current.login_locked) outcome = 'already_locked';
        else if (!countFailure) outcome = 'refused';
        else { outcome = await incrementLoginFailure(client, accepted.id); check(); }
      }
      await recordAuditEventFn({ actorType: 'anonymous', eventType: 'login_failed', summary: 'Login failed',
        details: { username, outcome }, ...metadata }, client); check();
    }).result;
  } };
}
