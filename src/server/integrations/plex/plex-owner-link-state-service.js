/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createEncryptedSecretService } from '../../encrypted-secret-service.js';
import { startAuthLookup } from '../../auth-lookup-service.js';
import { readPlexSecretRecord } from './plex-callback-state-store.js';
import { ownerLinkStateName, ownerLinkBindingHash, parseOwnerLinkPending, captureOwnerLinkProof, invalidOwnerLink } from './plex-owner-link-policy.js';

export function createPlexOwnerLinkStateService({ encryptedSecretService = createEncryptedSecretService(), startReadFn = startAuthLookup } = {}) {
  return { async read({ state, browserBinding }) {
    const name = ownerLinkStateName(state); ownerLinkBindingHash(browserBinding);
    const record = await startReadFn(client => readPlexSecretRecord(client, name)).result;
    if (!record) throw invalidOwnerLink();
    let plaintext;
    try { plaintext = encryptedSecretService.decryptSecretRecord(record); } catch { throw invalidOwnerLink(); }
    const pending = parseOwnerLinkPending(plaintext, browserBinding, record.observed_at);
    return { ...pending, proof: captureOwnerLinkProof({ id: record.id, name, encryptedValue: record.encrypted_value,
      revision: record.state_revision, expiresAt: pending.expiresAt }) };
  } };
}
