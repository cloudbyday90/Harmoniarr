/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { startSessionWriteTransaction } from '../../session-write-transaction-service.js';
import { lockSessionFamily } from '../../session-family-lock-store.js';
import { lockRotationParent, assertRotationNotExpired } from '../../session-issuance-store.js';
import { createMaintenanceLockService } from '../../recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../recovery/maintenance-lock-write-guard-service.js';
import { captureOAuthAuthority, changedOAuthAuthority, invalidOAuthState, oauthLinkNames, changedOAuthLink } from './oauth-link-policy.js';
import { lockOAuthActor, lockOAuthLink } from './oauth-link-store.js';

export function createOAuthLinkOwnerService({ provider, startTransactionFn = startSessionWriteTransaction,
  maintenanceGuard = createMaintenanceLockWriteGuardService(createMaintenanceLockService()) }) {
  const names = oauthLinkNames(provider);
  async function run(acceptedAuthority, work, signal) {
    const authority = acceptedAuthority ? captureOAuthAuthority(provider, acceptedAuthority) : null;
    const outcome = await startTransactionFn(async (client, check) => {
      const current = () => { check(); if (signal?.aborted) throw changedOAuthLink(provider); };
      current();
      await maintenanceGuard.assertNoActiveWriteLocks({ operationLabel: 'Provider account linking', queryable: client }); current();
      if (authority) {
        const actor = await lockOAuthActor(client, authority.appUserId); current();
        if (!actor || actor.role !== 'admin' || actor.is_disabled || actor.must_change_password) return { refusal: 'actor' };
        await lockSessionFamily(client, authority.tokenFamilyId); current();
        const parent = await lockRotationParent(client, { ...authority, passwordChangedAt: actor.credential_epoch }); current();
        if (!parent || parent.is_revoked || parent.replaced_by_refresh_token_id || !parent.unexpired || !parent.current_password) return { refusal: 'actor' };
      }
      await lockOAuthLink(client, names.lockKey); current();
      const result = await work(client, current, authority); current();
      if (!result.refusal && authority) { await assertRotationNotExpired(client, authority.refreshTokenId); current(); }
      return result;
    }, { errorCode: `${provider}_oauth_unavailable` }).result;
    if (outcome.refusal === 'actor') throw changedOAuthAuthority(provider);
    if (outcome.refusal === 'token') throw changedOAuthLink(provider);
    if (outcome.refusal) throw invalidOAuthState(provider);
    return outcome;
  }
  return { administrator: (authority, work) => run(captureOAuthAuthority(provider, authority), work), refresh: (work, signal) => run(null, work, signal) };
}
