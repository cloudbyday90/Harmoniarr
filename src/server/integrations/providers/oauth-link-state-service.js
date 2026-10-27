/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createEncryptedSecretService } from '../../encrypted-secret-service.js';
import { startAuthLookup } from '../../auth-lookup-service.js';
import { readOAuthRecord, readOAuthStatus } from './oauth-link-store.js';
import { oauthLinkNames, isOAuthState, oauthBindingHash, invalidOAuthState, parseOAuthPending, captureOAuthProof, captureOAuthToken } from './oauth-link-policy.js';

export function createOAuthLinkStateService({ provider, encryptedSecretService = createEncryptedSecretService(), startReadFn = startAuthLookup }) {
  const names = oauthLinkNames(provider);
  const proof = row => captureOAuthProof(provider, { id: row.id, name: row.name, encryptedValue: row.encrypted_value, revision: row.state_revision });
  return {
    buildStatus: queryable => queryable ? readOAuthStatus(queryable, names.token) : startReadFn(client => readOAuthStatus(client, names.token)).result,
    async readPending({ state, browserBinding }) {
      if (!isOAuthState(state)) throw invalidOAuthState(provider);
      oauthBindingHash(provider, browserBinding);
      const row = await startReadFn(client => readOAuthRecord(client, names.pending + state)).result;
      if (!row) throw invalidOAuthState(provider);
      let value;
      try { value = encryptedSecretService.decryptSecretRecord(row); } catch { throw invalidOAuthState(provider); }
      return { ...parseOAuthPending(provider, value, browserBinding, row.observed_at), proof: proof(row) };
    },
    async readToken() {
      const row = await startReadFn(client => readOAuthRecord(client, names.token)).result;
      if (!row) return null;
      const value = JSON.parse(encryptedSecretService.decryptSecretRecord(row));
      return { payload: captureOAuthToken(provider, value), credentialFingerprint: value.credentialFingerprint ?? null, proof: proof(row) };
    },
  };
}
