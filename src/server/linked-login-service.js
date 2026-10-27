/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createApiError } from './api-error.js';
import { startAuthLookup } from './auth-lookup-service.js';
import { selectLinkedLoginIdentity, selectPlexLoginSubjects } from './linked-login-policy.js';
import { findLinkedPlexLoginUser, lockLinkedLoginUser } from './linked-login-store.js';
import { recordSuccessfulLogin } from './login-bookkeeping-store.js';
import { selectSessionAuditMetadata } from './session-audit-metadata.js';
import { createSessionMaterial } from './session-issuance-policy.js';
import { startSessionWriteTransaction } from './session-write-transaction-service.js';
import { publishOwnedRootSession } from './session-root-publication-service.js';
import { recordAuditEvent } from './audit.js';

export function readLinkedPlexLoginUser(input, options) {
  const subjects = selectPlexLoginSubjects(input);
  return subjects.length ? startAuthLookup(client => findLinkedPlexLoginUser(client, subjects), options).result : Promise.resolve(null);
}

export function createLinkedLoginService({ startTransactionFn = startSessionWriteTransaction,
  createMaterialFn = createSessionMaterial, recordAuditEventFn = recordAuditEvent } = {}) {
  return { async loginLinkedUser(input) {
    const identity = selectLinkedLoginIdentity(input), metadata = selectSessionAuditMetadata(input?.requestMetadata);
    if (!identity) throw createApiError(403, 'plex_sign_in_not_linked', 'This Plex account is not linked to a direct sign-in capable Harmoniarr user');
    const material = createMaterialFn();
    const result = await startTransactionFn(async (client, check) => {
      const current = await lockLinkedLoginUser(client, identity.userId); check();
      if (!current || current.auth_provider !== identity.provider || current.auth_subject !== identity.subject) return { refusal: 'not_linked' };
      if (current.is_disabled) return { refusal: 'unavailable' };
      const owner = await recordSuccessfulLogin(client, identity.userId); check();
      const issuedSession = await publishOwnedRootSession(client, { owner, material, metadata }, check);
      await recordAuditEventFn({ actorUserId: owner.id, actorType: 'user', eventType: 'plex_sign_in_succeeded',
        summary: 'Plex direct sign-in succeeded', entityType: 'app_user', entityId: owner.id, required: true, ...metadata }, client); check();
      return { user: owner, issuedSession };
    }).result;
    if (result.refusal === 'unavailable') throw createApiError(403, 'account_unavailable', 'The linked Harmoniarr account is not available');
    if (result.refusal) throw createApiError(403, 'plex_sign_in_not_linked', 'This Plex account is not linked to a direct sign-in capable Harmoniarr user');
    return result;
  } };
}
