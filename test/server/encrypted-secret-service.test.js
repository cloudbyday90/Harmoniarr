import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEncryptedSecretService,
  decryptSecretValue,
  encryptSecretValue,
  resolveSecretEncryptionKey,
  secretEncryptionKeyEnvVar,
} from '../../src/server/encrypted-secret-service.js';

test('resolveSecretEncryptionKey accepts 32-byte hex or base64 values', () => {
  const hexKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const base64Key = Buffer.alloc(32, 7).toString('base64');

  assert.equal(resolveSecretEncryptionKey(hexKey).length, 32);
  assert.equal(resolveSecretEncryptionKey(base64Key).length, 32);
});

test('encryptSecretValue and decryptSecretValue round-trip plaintext secrets', () => {
  const key = Buffer.alloc(32, 9);
  const encrypted = encryptSecretValue('stored-api-key', key);

  assert.equal(decryptSecretValue(encrypted, key), 'stored-api-key');
});

test('createEncryptedSecretService rejects writes when the encryption key is missing', async () => {
  const queryable = {
    query: async () => ({ rows: [] }),
  };
  const service = createEncryptedSecretService({
    encryptionKey: null,
    getPoolFn: () => queryable,
  });

  await assert.rejects(
    () => service.setSecretValue({
      secretType: 'integration_credential',
      name: 'slskd.apiKey',
      plaintextValue: 'secret-api-key',
      queryable,
    }),
    (error) => error?.status === 400
      && error?.code === 'validation_error'
      && error?.message === `${secretEncryptionKeyEnvVar} must be configured before storing encrypted secrets`,
  );
});