/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { randomUUID } from 'node:crypto';
import { createEncryptedSecretService } from '../../encrypted-secret-service.js';
import { startSessionWriteTransaction } from '../../session-write-transaction-service.js';
import { lockSessionFamily } from '../../session-family-lock-store.js';
import { lockRotationParent, assertRotationNotExpired } from '../../session-issuance-store.js';
import { createMaintenanceLockService } from '../../recovery/maintenance-lock-service.js';
import { createMaintenanceLockWriteGuardService } from '../../recovery/maintenance-lock-write-guard-service.js';
import { selectSessionAuditMetadata } from '../../session-audit-metadata.js';
import { recordAuditEvent } from '../../audit.js';
import { readPlexSecretRecord, getPlexCallbackExpiry, consumePlexCallbackState, assertPlexCallbackNotExpired } from './plex-callback-state-store.js';
import { isPlexCallbackState } from './plex-callback-policy.js';
import { ownerLinkSecretType, ownerLinkTokenName, ownerLinkClientName, ownerLinkRevisionName,
  ownerLinkStateName, ownerLinkBindingHash, captureOwnerLinkAuthority, captureOwnerLinkProof, invalidOwnerLink, ownerLinkForbidden } from './plex-owner-link-policy.js';
import { lockOwnerLink, lockOwnerLinkActor, readOwnerLinkSecretRows, readOwnerLinkClock, readOwnerLinkStatus } from './plex-owner-link-store.js';

export function createPlexOwnerLinkCommandService({ encryptedSecretService = createEncryptedSecretService(),
  startTransactionFn = startSessionWriteTransaction, recordAuditEventFn = recordAuditEvent,
  maintenanceGuard = createMaintenanceLockWriteGuardService(createMaintenanceLockService()) } = {}) {
  async function readValue(client, name) {
    const row = await readPlexSecretRecord(client, name);
    return row ? encryptedSecretService.decryptSecretRecord(row) : null;
  }
  async function save(client, name, value, metadata = null) {
    if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 8192) throw new Error('Owner link secret exceeds its bound');
    await encryptedSecretService.setSecretValue({ secretType: ownerLinkSecretType, name, plaintextValue: value, metadata, queryable: client });
    const rows = await readOwnerLinkSecretRows(client, name);
    if (rows.length !== 1 || !rows[0].encrypted_value || encryptedSecretService.decryptSecretRecord(rows[0]) !== value) throw new Error('Owner link secret publication was not confirmed');
  }
  async function owned(value, work) {
    const authority = captureOwnerLinkAuthority(value);
    const result = await startTransactionFn(async (client, check) => {
      await maintenanceGuard.assertNoActiveWriteLocks({ operationLabel: 'Plex owner linking', queryable: client }); check();
      const actor = await lockOwnerLinkActor(client, authority.appUserId); check();
      if (!actor || actor.role !== 'admin' || actor.is_disabled || actor.must_change_password) return { refusal: 'actor' };
      await lockSessionFamily(client, authority.tokenFamilyId); check();
      const parent = await lockRotationParent(client, { ...authority, passwordChangedAt: actor.credential_epoch }); check();
      if (!parent || parent.is_revoked || parent.replaced_by_refresh_token_id || !parent.unexpired || !parent.current_password) return { refusal: 'actor' };
      await lockOwnerLink(client); check();
      const outcome = await work(client, check, authority);
      if (!outcome.refusal) { await assertRotationNotExpired(client, authority.refreshTokenId); check(); }
      return outcome;
    }, { errorCode: 'plex_link_unavailable' }).result;
    if (result.refusal === 'actor') throw ownerLinkForbidden();
    if (result.refusal) throw invalidOwnerLink();
    return result;
  }
  return {
    prepare(authority) {
      return owned(authority, async (client, check) => {
        let clientIdentifier = await readValue(client, ownerLinkClientName); check();
        if (clientIdentifier === null) { clientIdentifier = randomUUID(); await save(client, ownerLinkClientName, clientIdentifier); check(); }
        if (typeof clientIdentifier !== 'string' || !clientIdentifier || clientIdentifier.length > 256) throw new Error('Invalid owner client identifier');
        let linkRevision = await readValue(client, ownerLinkRevisionName); check();
        if (linkRevision === null) { linkRevision = randomUUID(); await save(client, ownerLinkRevisionName, linkRevision, { version: 1 }); check(); }
        if (!isPlexCallbackState(linkRevision)) throw new Error('Invalid owner link revision');
        return { clientIdentifier, linkRevision };
      });
    },
    createPending({ authority, state, browserBinding, clientIdentifier, pinId, linkRevision, requestMetadata }) {
      const name = ownerLinkStateName(state), browserBindingHash = ownerLinkBindingHash(browserBinding), metadata = selectSessionAuditMetadata(requestMetadata);
      if (![clientIdentifier, pinId].every(value => typeof value === 'string' && value.length > 0 && value.length <= 256)
        || !isPlexCallbackState(linkRevision)) throw invalidOwnerLink();
      return owned(authority, async (client, check, acceptedAuthority) => {
        if (await readValue(client, ownerLinkRevisionName) !== linkRevision) return { refusal: 'revision' }; check();
        const expiresAt = await getPlexCallbackExpiry(client); check();
        await save(client, name, JSON.stringify({ version: 1, kind: 'owner_link', browserBindingHash, authority: acceptedAuthority, clientIdentifier, pinId, linkRevision, expiresAt }), { version: 1, expiresAt }); check();
        await recordAuditEventFn({ actorUserId: acceptedAuthority.appUserId, actorType: 'user', eventType: 'plex_owner_link_started', entityType: 'provider_link',
          summary: 'Plex owner account linking started', details: { expiresAt, provider: 'plex' }, required: true, ...metadata }, client); check();
        return { expiresAt };
      });
    },
    complete({ pending, accessToken, profile, requestMetadata }) {
      const authority = captureOwnerLinkAuthority(pending.authority), proof = captureOwnerLinkProof(pending.proof), linkRevision = pending.linkRevision;
      const acceptedProfile = { ...profile }, clientIdentifier = pending.clientIdentifier, metadata = selectSessionAuditMetadata(requestMetadata);
      if (!isPlexCallbackState(linkRevision) || proof.expiresAt !== pending.expiresAt
        || typeof accessToken !== 'string' || !accessToken || accessToken.length > 4096
        || typeof clientIdentifier !== 'string' || !clientIdentifier || clientIdentifier.length > 256) throw invalidOwnerLink();
      return owned(authority, async (client, check) => {
        if (await readValue(client, ownerLinkRevisionName) !== linkRevision) return { refusal: 'revision' }; check();
        if (!await consumePlexCallbackState(client, proof)) return { refusal: 'state' }; check();
        const linkedAt = await readOwnerLinkClock(client); check();
        await save(client, ownerLinkTokenName, JSON.stringify({ accessToken, clientIdentifier, linkedAt, user: acceptedProfile }),
          { linkedAt, linkedUserEmail: acceptedProfile.email, linkedUserId: acceptedProfile.id, linkedUserTitle: acceptedProfile.title,
            linkedUsername: acceptedProfile.username, linkedUserUuid: acceptedProfile.uuid, thumbUrl: acceptedProfile.thumbUrl }); check();
        await save(client, ownerLinkRevisionName, randomUUID(), { version: 1 }); check();
        const status = await readOwnerLinkStatus(client); check();
        await recordAuditEventFn({ actorUserId: authority.appUserId, actorType: 'user', eventType: 'plex_owner_link_completed', entityType: 'provider_link',
          summary: 'Plex owner account linked', details: { provider: 'plex' }, required: true, ...metadata }, client); check();
        await assertPlexCallbackNotExpired(client, proof); check();
        return { provider: 'plex', status };
      });
    },
    clear({ authority, requestMetadata }) {
      const metadata = selectSessionAuditMetadata(requestMetadata);
      return owned(authority, async (client, check, acceptedAuthority) => {
        await encryptedSecretService.clearSecretValue({ secretType: ownerLinkSecretType, name: ownerLinkTokenName, queryable: client }); check();
        if ((await readOwnerLinkSecretRows(client, ownerLinkTokenName)).length) throw new Error('Owner unlink was not confirmed'); check();
        await save(client, ownerLinkRevisionName, randomUUID(), { version: 1 }); check();
        await recordAuditEventFn({ actorUserId: acceptedAuthority.appUserId, actorType: 'user', eventType: 'plex_owner_link_cleared', entityType: 'provider_link',
          summary: 'Plex owner account link cleared', details: { provider: 'plex' }, required: true, ...metadata }, client); check();
        return { provider: 'plex', status: await readOwnerLinkStatus(client) };
      });
    },
  };
}
