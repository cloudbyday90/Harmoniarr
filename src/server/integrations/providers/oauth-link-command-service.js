/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { randomUUID } from 'node:crypto';
import { createEncryptedSecretService } from '../../encrypted-secret-service.js';
import { recordAuditEvent } from '../../audit.js';
import { selectSessionAuditMetadata } from '../../session-audit-metadata.js';
import { buildTokenMetadata } from './oauth-helpers.js';
import { createOAuthLinkOwnerService } from './oauth-link-owner-service.js';
import { oauthLinkNames, oauthSecretType, oauthBindingHash, captureOAuthAuthority, captureOAuthProof, captureOAuthToken, invalidOAuthState, isOAuthState, isOAuthRevision } from './oauth-link-policy.js';
import { readOAuthRecord, readOAuthExpiry, assertOAuthNotExpired, consumeOAuthState, lockOAuthRecordProof, readOAuthStatus, lockOAuthConfiguration } from './oauth-link-store.js';

export function createOAuthLinkCommandService({ provider, encryptedSecretService = createEncryptedSecretService(), recordAuditEventFn = recordAuditEvent,
  readCredentialsFingerprint, owner = createOAuthLinkOwnerService({ provider }) }) {
  const names = oauthLinkNames(provider);
  async function value(client, name) {
    const row = await readOAuthRecord(client, name);
    return row ? encryptedSecretService.decryptSecretRecord(row) : null;
  }
  async function save(client, name, plaintextValue, metadata) {
    if (typeof plaintextValue !== 'string' || Buffer.byteLength(plaintextValue, 'utf8') > 12 * 1024) throw new Error('OAuth secret exceeds its bound');
    await encryptedSecretService.setSecretValue({ secretType: oauthSecretType, name, plaintextValue, metadata, queryable: client });
    const row = await readOAuthRecord(client, name);
    if (!row || encryptedSecretService.decryptSecretRecord(row) !== plaintextValue) throw new Error('OAuth secret publication was not confirmed');
  }
  async function credentialsMatch(client, expected) {
    await lockOAuthConfiguration(client, provider);
    return expected === await readCredentialsFingerprint(client);
  }
  const audit = (client, event, authority, metadata, details = {}) => recordAuditEventFn({ actorType: authority ? 'user' : 'system',
    actorUserId: authority?.appUserId ?? null, eventType: `${provider}_oauth_${event}`, entityType: 'provider_oauth',
    summary: `Provider authorization ${event}`, details: { provider, ...details }, required: true, ...metadata }, client);
  return {
    prepare(authority) {
      return owner.administrator(authority, async (client, check) => {
        let linkRevision = await value(client, names.revision); check();
        if (linkRevision === null) { linkRevision = randomUUID(); await save(client, names.revision, linkRevision, { version: 1 }); check(); }
        if (!isOAuthRevision(linkRevision)) throw invalidOAuthState(provider);
        return { linkRevision };
      });
    },
    createPending({ authority, state, browserBinding, codeVerifier, redirectUri, credentialFingerprint, linkRevision, requestMetadata }) {
      const acceptedAuthority = captureOAuthAuthority(provider, authority), browserBindingHash = oauthBindingHash(provider, browserBinding);
      const metadata = selectSessionAuditMetadata(requestMetadata);
      if (!isOAuthState(state) || typeof codeVerifier !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/u.test(codeVerifier)
        || typeof redirectUri !== 'string' || redirectUri.length > 2048 || !/^[a-f0-9]{64}$/u.test(credentialFingerprint ?? '')) throw invalidOAuthState(provider);
      return owner.administrator(acceptedAuthority, async (client, check) => {
        if (await value(client, names.revision) !== linkRevision || !await credentialsMatch(client, credentialFingerprint)) return { refusal: 'state' }; check();
        const expiresAt = await readOAuthExpiry(client); check();
        await save(client, names.pending + state, JSON.stringify({ version: 1, kind: 'provider_oauth', provider, authority: acceptedAuthority,
          browserBindingHash, codeVerifier, redirectUri, credentialFingerprint, linkRevision, expiresAt }), { version: 1, expiresAt }); check();
        await audit(client, 'started', acceptedAuthority, metadata, { expiresAt }); check();
        return { expiresAt };
      });
    },
    admitPending(pending) {
      const authority = captureOAuthAuthority(provider, pending.authority), proof = captureOAuthProof(provider, pending.proof);
      const { linkRevision, credentialFingerprint, expiresAt } = pending;
      if (!proof.name.startsWith(names.pending)) throw invalidOAuthState(provider);
      return owner.administrator(authority, async (client, check) => {
        if (await value(client, names.revision) !== linkRevision || !await credentialsMatch(client, credentialFingerprint)
          || !await lockOAuthRecordProof(client, proof)) return { refusal: 'state' }; check();
        await assertOAuthNotExpired(client, expiresAt); check();
        return { admitted: true };
      });
    },
    complete({ pending, tokenPayload, requestMetadata }) {
      const authority = captureOAuthAuthority(provider, pending.authority), proof = captureOAuthProof(provider, pending.proof);
      const { linkRevision, credentialFingerprint, expiresAt } = pending, payload = captureOAuthToken(provider, tokenPayload);
      const metadata = selectSessionAuditMetadata(requestMetadata);
      if (!proof.name.startsWith(names.pending)) throw invalidOAuthState(provider);
      return owner.administrator(authority, async (client, check) => {
        if (await value(client, names.revision) !== linkRevision || !await credentialsMatch(client, credentialFingerprint)) return { refusal: 'state' }; check();
        if (!await consumeOAuthState(client, proof, expiresAt)) return { refusal: 'state' }; check();
        await save(client, names.token, JSON.stringify({ ...payload, credentialFingerprint }), buildTokenMetadata(payload)); check();
        await save(client, names.revision, randomUUID(), { version: 1 }); check();
        await audit(client, 'completed', authority, metadata); check();
        await assertOAuthNotExpired(client, expiresAt); check();
        await assertOAuthNotExpired(client, payload.expiresAt); check();
        return { provider, status: await readOAuthStatus(client, names.token) };
      });
    },
    clear({ authority, requestMetadata }) {
      const metadata = selectSessionAuditMetadata(requestMetadata);
      return owner.administrator(authority, async (client, check, acceptedAuthority) => {
        let revocationToken = null;
        const record = await value(client, names.token); check();
        try { revocationToken = captureOAuthToken(provider, JSON.parse(record)).accessToken; } catch { /* Invalid stored credentials can still be cleared. */ }
        await encryptedSecretService.clearSecretValue({ secretType: oauthSecretType, name: names.token, queryable: client }); check();
        if (await readOAuthRecord(client, names.token)) throw new Error('OAuth credential deletion was not confirmed'); check();
        await save(client, names.revision, randomUUID(), { version: 1 }); check();
        await audit(client, 'cleared', acceptedAuthority, metadata); check();
        return { provider, status: await readOAuthStatus(client, names.token), revocationToken };
      });
    },
    refresh({ snapshot, tokenPayload, credentialFingerprint, signal }) {
      const proof = captureOAuthProof(provider, snapshot.proof), payload = captureOAuthToken(provider, tokenPayload);
      if (proof.name !== names.token) throw invalidOAuthState(provider);
      return owner.refresh(async (client, check) => {
        if (!await lockOAuthRecordProof(client, proof) || !await credentialsMatch(client, credentialFingerprint)) return { refusal: 'token' }; check();
        await save(client, names.token, JSON.stringify({ ...payload, credentialFingerprint }), buildTokenMetadata(payload)); check();
        await audit(client, 'refreshed', null, {}); check();
        await assertOAuthNotExpired(client, payload.expiresAt); check();
        return { accessToken: payload.accessToken };
      }, signal);
    },
  };
}
