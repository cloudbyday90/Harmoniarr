/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { recordAuditEvent } from './audit.js';
import { revokeReplayedSessionFamily } from './session-replay-store.js';
import { startSessionReplayTransaction } from './session-replay-transaction-service.js';
import { lockSessionOwner, lockSessionFamily } from './session-family-lock-store.js';
import { selectSessionAuditMetadata } from './session-audit-metadata.js';

/** Caller owns account/family locks and transaction; never acquires another client. */
export async function applySessionReplay(client, identity, metadata, check, {
  revokeFamilyFn = revokeReplayedSessionFamily, recordAuditEventFn = recordAuditEvent,
} = {}) {
  check();
  const { revokedSessions, previousRevokedReason } = await revokeFamilyFn(client, identity);
  check();
  if (revokedSessions > 0) {
    await recordAuditEventFn({
      actorUserId: identity.appUserId, actorType: 'user', eventType: 'refresh_token_reuse_detected',
      summary: 'Refresh token reuse detected; active session family revoked',
      entityType: 'refresh_token', entityId: identity.refreshTokenId,
      details: { tokenFamilyId: identity.tokenFamilyId, previousRevokedReason }, ...metadata,
    }, client);
  }
  return revokedSessions;
}

export function createSessionReplayService({ startTransactionFn = startSessionReplayTransaction,
  revokeFamilyFn = revokeReplayedSessionFamily, recordAuditEventFn = recordAuditEvent } = {}) {
  return async function handleSessionReplay({ row, requestMetadata }) {
    // Capture only server-observed identities and selected metadata before any wait.
    const identity = { refreshTokenId: row.refresh_token_id, appUserId: row.app_user_id, tokenFamilyId: row.token_family_id };
    const metadata = selectSessionAuditMetadata(requestMetadata);
    return startTransactionFn(async (client, check) => {
      check();
      const owner = await lockSessionOwner(client, identity.appUserId); check();
      if (!owner || owner.is_disabled) return 0;
      await lockSessionFamily(client, identity.tokenFamilyId); check();
      return applySessionReplay(client, identity, metadata, check, { revokeFamilyFn, recordAuditEventFn });
    }).result;
  };
}

export const handleSessionReplay = createSessionReplayService();
