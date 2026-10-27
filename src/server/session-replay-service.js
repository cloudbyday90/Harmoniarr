/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { isIP } from 'node:net';
import { recordAuditEvent } from './audit.js';
import { revokeReplayedSessionFamily } from './session-replay-store.js';
import { startSessionReplayTransaction } from './session-replay-transaction-service.js';

export function createSessionReplayService({ startTransactionFn = startSessionReplayTransaction,
  revokeFamilyFn = revokeReplayedSessionFamily, recordAuditEventFn = recordAuditEvent } = {}) {
  return async function handleSessionReplay({ row, requestMetadata }) {
    // Capture only server-observed identities and selected metadata before any wait.
    const identity = { refreshTokenId: row.refresh_token_id, appUserId: row.app_user_id, tokenFamilyId: row.token_family_id };
    // Selected request headers are evidence, not authority. Malformed INET input
    // must not let a caller veto revocation through the required audit insert.
    const address = requestMetadata?.ipAddress;
    const ipAddress = typeof address === 'string' && !address.includes('%') && isIP(address) ? address : null;
    const userAgent = typeof requestMetadata?.userAgent === 'string' ? requestMetadata.userAgent : null;
    return startTransactionFn(async (client, check) => {
      check();
      const { revokedSessions, previousRevokedReason } = await revokeFamilyFn(client, identity);
      check();
      if (revokedSessions > 0) {
        await recordAuditEventFn({
          actorUserId: identity.appUserId, actorType: 'user', eventType: 'refresh_token_reuse_detected',
          summary: 'Refresh token reuse detected; active session family revoked',
          entityType: 'refresh_token', entityId: identity.refreshTokenId,
          details: { tokenFamilyId: identity.tokenFamilyId, previousRevokedReason }, ipAddress, userAgent,
        }, client);
      }
      return revokedSessions;
    }).result;
  };
}

export const handleSessionReplay = createSessionReplayService();
