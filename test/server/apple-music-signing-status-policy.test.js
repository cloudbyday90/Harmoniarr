/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { buildAppleMusicSigningStatus } from '../../src/server/integrations/apple-music/apple-music-signing-status-policy.js';

const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = (key, type = 'pkcs8') => key.export({ type, format: 'pem' });
const credentials = { teamId: 'TESTTEAM01', keyId: 'TESTKEY001', privateKey: pem(pair.privateKey) };

test('local status accepts supported saved PEM formats and returns only fixed state fields', () => {
  for (const type of ['pkcs8', 'sec1']) {
    const input = { ...credentials, teamId: ' aBc123Xy90 ', privateKey: ' \n' + pem(pair.privateKey, type) };
    const before = structuredClone(input), status = buildAppleMusicSigningStatus(input);
    assert.deepEqual(status, { state: 'valid', checks: { teamId: 'valid', keyId: 'valid', privateKey: 'valid' } });
    assert.deepEqual(input, before); assert.ok(!JSON.stringify(status).includes(input.teamId.trim()));
  }
});

test('missing and blank fields report incomplete without confusing presence and validity', () => {
  for (const value of [undefined, null, '', ' \n ']) {
    assert.deepEqual(buildAppleMusicSigningStatus({ teamId: value, keyId: value, privateKey: value }),
      { state: 'incomplete', checks: { teamId: 'missing', keyId: 'missing', privateKey: 'missing' } });
  }
});

for (const field of ['teamId', 'keyId']) test(`local status classifies invalid ${field} without disclosing its input`, () => {
  for (const value of [123, {}, [], 'SHORT', 'TOOLONG0000', '12345-7890', 'ＡBC123XY90', 'PRIVATE-status-sentinel']) {
    const status = buildAppleMusicSigningStatus({ ...credentials, [field]: value });
    assert.equal(status.state, 'invalid'); assert.equal(status.checks[field], 'invalid');
    assert.ok(!JSON.stringify(status).includes('PRIVATE-status-sentinel'));
  }
});

for (const [name, privateKey] of [
  ['malformed', 'PRIVATE-status-sentinel'], ['RSA', pem(generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey)],
  ['P-384', pem(generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey)],
  ['secp256k1', pem(generateKeyPairSync('ec', { namedCurve: 'secp256k1' }).privateKey)],
  ['Ed25519', pem(generateKeyPairSync('ed25519').privateKey)], ['public', pem(pair.publicKey, 'spki')],
  ['encrypted', pair.privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'PRIVATE-status-sentinel' })],
  ['oversized', credentials.privateKey + ' '.repeat(16_384)], ['descriptor', { key: 'PRIVATE-status-sentinel' }],
]) test(`local status rejects ${name} material without masking it behind missing IDs`, () => {
  assert.deepEqual(buildAppleMusicSigningStatus({ privateKey }), { state: 'invalid', checks: { teamId: 'missing', keyId: 'missing', privateKey: 'invalid' } });
});
