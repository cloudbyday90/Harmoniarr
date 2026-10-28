/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createSecretKey, generateKeyPairSync, verify } from 'node:crypto';
import { generateAppleMusicDeveloperToken, createAppleMusicDeveloperTokenService } from '../../src/server/integrations/apple-music/apple-music-developer-token-service.js';
import { createAppleMusicClient } from '../../src/server/integrations/apple-music/apple-music-client.js';

const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const credentials = { teamId: 'TESTTEAM01', keyId: 'TESTKEY001', privateKey: pair.privateKey };
const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url'));
const pem = pair.privateKey.export({ type: 'pkcs8', format: 'pem' });
const safeError = error => error.code === 'apple_music_misconfigured' && error.cause === undefined && !JSON.stringify({ ...error, message: error.message, stack: error.stack }).includes('PRIVATE-sentinel');

for (const [name, privateKey] of [['native private key', pair.privateKey], ['PKCS8 PEM', pem], ['SEC1 PEM', pair.privateKey.export({ type: 'sec1', format: 'pem' })], ['PEM Buffer', Buffer.from(pem)]]) {
  test('Apple signs and verifies admitted ' + name, () => {
    const { token, expiresAt } = generateAppleMusicDeveloperToken({ ...credentials, privateKey }); const [header, payload, signature] = token.split('.');
    assert.equal(verify('sha256', Buffer.from(header + '.' + payload), { key: pair.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), true);
    assert.equal(claims(token).exp - claims(token).iat, 3600); assert.equal(expiresAt, claims(token).exp * 1000); assert.equal(Buffer.from(signature, 'base64url').length, 64);
  });
}

const refused = [
  ['RSA', generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey],
  ['P384', generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey],
  ['secp256k1', generateKeyPairSync('ec', { namedCurve: 'secp256k1' }).privateKey],
  ['Ed25519', generateKeyPairSync('ed25519').privateKey],
  ['public KeyObject', pair.publicKey], ['public PEM', pair.publicKey.export({ type: 'spki', format: 'pem' })],
  ['symmetric KeyObject', createSecretKey(Buffer.alloc(32))], ['URL', new URL('file:///PRIVATE-sentinel')],
  ['loader descriptor', { key: new URL('file:///PRIVATE-sentinel') }], ['malformed PEM', 'PRIVATE-sentinel'],
  ['oversized PEM', 'PRIVATE-sentinel' + 'x'.repeat(16_384)], ['oversized Buffer', Buffer.alloc(16_385)],
];
for (const [name, privateKey] of refused) {
  test('Apple refuses ' + name + ' at helper and client before dispatch', async () => {
    assert.throws(() => generateAppleMusicDeveloperToken({ ...credentials, privateKey }), safeError);
    let calls = 0; const client = createAppleMusicClient({ ...credentials, privateKey, providerHttpService: { request() { calls++; } } });
    await assert.rejects(client.getCatalogSong('us', 'fixture'), safeError); assert.equal(calls, 0);
  });
}

test('Apple captures native key and identifier values before caller mutation', () => {
  const privateKey = Buffer.from(pem), accepted = { ...credentials, privateKey }, service = createAppleMusicDeveloperTokenService(accepted);
  privateKey.fill(0); accepted.keyId = 'changed'; accepted.teamId = 'changed';
  const token = service.getToken(), [header, payload, signature] = token.split('.');
  assert.equal(JSON.parse(Buffer.from(header, 'base64url')).kid, credentials.keyId); assert.equal(claims(token).iss, credentials.teamId);
  assert.equal(verify('sha256', Buffer.from(header + '.' + payload), { key: pair.publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), true);
});

test('Apple bounded identifiers refuse nonstring, empty and oversized values without native details', () => {
  for (const patch of [{ teamId: {} }, { keyId: [] }, { teamId: ' ' }, { keyId: 'PRIVATE-sentinel' + 'x'.repeat(256) }]) assert.throws(() => generateAppleMusicDeveloperToken({ ...credentials, ...patch }), safeError);
});

test('Apple cache renews after backward clock observation even while old issuance remains in the past', () => {
  let now = Date.UTC(2026, 9, 28); const start = now, service = createAppleMusicDeveloperTokenService(credentials, { getNow: () => now });
  const initial = service.getToken(); now += 600_000; assert.equal(service.getToken(), initial);
  now -= 300_000; const renewed = service.getToken(); assert.notEqual(renewed, initial); assert.equal(claims(renewed).iat, (start + 300_000) / 1000);
  now = start - 1000; const earlier = service.getToken(); assert.notEqual(earlier, renewed); assert.equal(claims(earlier).iat, now / 1000);
});

test('Apple invalid clock refuses cached fallback and a later valid clock issues afresh', () => {
  const start = Date.UTC(2026, 9, 28); let now = start; const service = createAppleMusicDeveloperTokenService(credentials, { getNow: () => now });
  const initial = service.getToken();
  for (const invalid of [NaN, Infinity, -1, 1.5, Number.MAX_SAFE_INTEGER, 'PRIVATE-sentinel']) { now = invalid; assert.throws(() => service.getToken(), safeError); }
  now = start + 1000; const recovered = service.getToken(); assert.notEqual(recovered, initial); assert.equal(claims(recovered).iat, now / 1000);
});

test('Apple clock failure is sanitized and cannot return a prior cache entry', () => {
  let fail = false; const service = createAppleMusicDeveloperTokenService(credentials, { getNow() { if (fail) throw new Error('PRIVATE-sentinel'); return Date.UTC(2026, 9, 28); } });
  service.getToken(); fail = true; assert.throws(() => service.getToken(), safeError);
});

test('Apple direct helper refuses invalid native clock values without issuing credentials', t => {
  t.mock.method(Date, 'now', () => Infinity); assert.throws(() => generateAppleMusicDeveloperToken(credentials), safeError);
});
