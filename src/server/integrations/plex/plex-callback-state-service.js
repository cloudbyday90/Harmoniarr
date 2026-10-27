/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { randomUUID } from 'node:crypto';
import { createEncryptedSecretService } from '../../encrypted-secret-service.js';
import { startAuthLookup } from '../../auth-lookup-service.js';
import { startSessionWriteTransaction } from '../../session-write-transaction-service.js';
import { recordAuditEvent } from '../../audit.js';
import { selectSessionAuditMetadata } from '../../session-audit-metadata.js';
import { plexCallbackSecretType, plexClientIdentifierName, plexClientIdentifierLockKey, plexCallbackSecretName,
  hashPlexBrowserBinding, parsePlexPendingState, capturePlexCallbackProof, invalidPlexCallback } from './plex-callback-policy.js';
import { readPlexSecretRecord, getPlexCallbackExpiry } from './plex-callback-state-store.js';

export function createPlexCallbackStateService({ encryptedSecretService = createEncryptedSecretService(),
  startReadFn = startAuthLookup, startTransactionFn = startSessionWriteTransaction, recordAuditEventFn = recordAuditEvent } = {}) {
  return {
    async resolveClientIdentifier() {
      return startTransactionFn(async (client, check) => {
        await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [plexClientIdentifierLockKey]); check();
        const record = await readPlexSecretRecord(client, plexClientIdentifierName); check();
        if (record) {
          const value = encryptedSecretService.decryptSecretRecord(record);
          if (typeof value !== 'string' || !value.trim() || value.length > 256) throw new Error('Invalid Plex client identifier');
          return value.trim();
        }
        const value = randomUUID();
        await encryptedSecretService.setSecretValue({ secretType: plexCallbackSecretType, name: plexClientIdentifierName, plaintextValue: value, queryable: client }); check();
        return value;
      }).result;
    },
    async create({ state, browserBinding, clientIdentifier, pinId, redirectTo, requestMetadata }) {
      const name = plexCallbackSecretName(state), browserBindingHash = hashPlexBrowserBinding(browserBinding), metadata = selectSessionAuditMetadata(requestMetadata);
      if (![clientIdentifier, pinId].every(value => typeof value === 'string' && value.length > 0 && value.length <= 256)
        || typeof redirectTo !== 'string' || redirectTo.length > 2048) throw invalidPlexCallback();
      return startTransactionFn(async (client, check) => {
        const expiresAt = await getPlexCallbackExpiry(client); check();
        await encryptedSecretService.setSecretValue({ secretType: plexCallbackSecretType, name,
          plaintextValue: JSON.stringify({ version: 1, browserBindingHash, clientIdentifier, pinId, redirectTo, expiresAt }),
          metadata: { version: 1, expiresAt }, queryable: client }); check();
        await recordAuditEventFn({ actorType: 'anonymous', eventType: 'plex_sign_in_started', entityType: 'auth_flow',
          summary: 'Plex direct sign-in started', details: { expiresAt, provider: 'plex' }, required: true, ...metadata }, client); check();
        return expiresAt;
      }).result;
    },
    async read({ state, browserBinding }) {
      const name = plexCallbackSecretName(state); hashPlexBrowserBinding(browserBinding);
      const record = await startReadFn(client => readPlexSecretRecord(client, name)).result;
      if (!record) throw invalidPlexCallback();
      let plaintext;
      try { plaintext = encryptedSecretService.decryptSecretRecord(record); } catch { throw invalidPlexCallback(); }
      const payload = parsePlexPendingState(plaintext, browserBinding, record.observed_at);
      return { ...payload, proof: capturePlexCallbackProof({ id: record.id, name, encryptedValue: record.encrypted_value,
        revision: record.state_revision, expiresAt: payload.expiresAt }) };
    },
  };
}
