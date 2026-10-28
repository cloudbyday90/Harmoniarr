/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';
import { createProviderCredentialsService } from '../../src/server/integrations/providers/provider-credentials-service.js';
import { normalizeSettingsPatch } from '../../src/server/validators/settings-validator.js';

const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const pem = (key, type = 'pkcs8') => key.export({ format: 'pem', type });
const privatePem = pem(pair.privateKey);
function owner() {
  const writes = [];
  const service = createProviderCredentialsService({ env: {}, encryptedSecretService: {
    setSecretValue: async value => writes.push(value), clearSecretValue: async value => writes.push(value),
  } });
  return { writes, service };
}
const safeError = error => error.status === 400 && error.code === 'validation_error' && error.cause === undefined
  && !JSON.stringify({ ...error, message: error.message }).includes('PRIVATE-input-sentinel');

for (const [name, value] of [
  ['malformed', 'PRIVATE-input-sentinel'], ['RSA', pem(generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey)],
  ['P-384', pem(generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).privateKey)],
  ['secp256k1', pem(generateKeyPairSync('ec', { namedCurve: 'secp256k1' }).privateKey)],
  ['Ed25519', pem(generateKeyPairSync('ed25519').privateKey)], ['public', pem(pair.publicKey, 'spki')],
  ['encrypted', pair.privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: 'PRIVATE-input-sentinel' })],
  ['oversized', privatePem + ' '.repeat(16_384)], ['non-string', { key: 'PRIVATE-input-sentinel' }],
]) {
  test(`Apple replacement rejects ${name} before any secret write`, () => {
    const { service, writes } = owner();
    assert.throws(() => service.buildSecretMutation({ providers: { spotifyClientSecret: 'also-pending', appleMusicPrivateKey: value } }), safeError);
    assert.deepEqual(writes, []);
  });
}

for (const format of ['pkcs8', 'sec1']) test(`Apple ${format} replacement preserves sanitized mutation and encrypted owner`, async () => {
  const { service, writes } = owner(), material = pem(pair.privateKey, format);
  const patch = { providers: { appleMusicPrivateKey: ' \n' + material + ' ', appleMusicKeyId: 'TESTKEY001' } };
  const mutation = service.buildSecretMutation(patch), queryable = {};
  assert.deepEqual(mutation.sanitizedPatch, { providers: { appleMusicKeyId: 'TESTKEY001' } });
  assert.deepEqual(mutation.updatedKeys, ['providers.appleMusicPrivateKey']);
  patch.providers.appleMusicPrivateKey = 'PRIVATE-input-sentinel';
  await mutation.apply(queryable);
  assert.equal(writes.length, 1); assert.equal(writes[0].plaintextValue, material.trim());
  assert.equal(writes[0].queryable, queryable); assert.equal(writes[0].name, 'providers.appleMusic.privateKey');
});

test('Apple omitted and blank replacement retain; explicit clear remains independent', async () => {
  const { service, writes } = owner();
  for (const providers of [{ appleMusicKeyId: 'TESTKEY001' }, { appleMusicPrivateKey: ' \n ' }, { clearAppleMusicPrivateKey: false }]) {
    const mutation = service.buildSecretMutation({ providers });
    assert.deepEqual(mutation.updatedKeys, []); await mutation.apply({});
  }
  assert.deepEqual(writes, []);
  const mutation = service.buildSecretMutation({ providers: { appleMusicPrivateKey: '', clearAppleMusicPrivateKey: true } });
  await mutation.apply({}); assert.equal(writes.length, 1); assert.equal(writes[0].plaintextValue, undefined);
  assert.throws(() => service.buildSecretMutation({ providers: { appleMusicPrivateKey: privatePem, clearAppleMusicPrivateKey: true } }), safeError);
  assert.throws(() => service.buildSecretMutation({ providers: { clearAppleMusicPrivateKey: 'yes' } }), safeError);
});

for (const field of ['appleMusicKeyId', 'appleMusicTeamId']) {
  test(`Apple ${field} accepts staged reset and case-preserving ASCII identifier`, () => {
    for (const [raw, normalized] of [[' Abc123Xy90 ', 'Abc123Xy90'], ['', ''], [' \n ', '']]) {
      assert.deepEqual(normalizeSettingsPatch({ providers: { [field]: raw } }), [{ namespace: 'providers', settingKey: field, value: normalized }]);
    }
  });
  test(`Apple ${field} rejects wrong type, length, punctuation and Unicode without echo`, () => {
    for (const raw of [null, 123, {}, [], 'SHORT', 'TOOLONG0000', '12345-7890', '12345 7890', '123456789\n0', 'ＡBC123XY90', 'PRIVATE-input-sentinel']) {
      assert.throws(() => normalizeSettingsPatch({ providers: { [field]: raw, requestTimeoutMs: 12000 } }), safeError);
    }
  });
}
