import assert from 'node:assert/strict';
import test from 'node:test';
import { computeKeyFingerprint, createBackupEncryptionService } from '../../src/server/recovery/backup-encryption-service.js';
import { createHash, randomBytes } from 'node:crypto';

function generateTestKey() {
  return randomBytes(32);
}

test('computeKeyFingerprint produces a consistent hex digest for a given key', () => {
  const key = generateTestKey();
  const fingerprint = computeKeyFingerprint(key);

  assert.equal(fingerprint, createHash('sha256').update(key).digest('hex'));
  assert.equal(fingerprint.length, 64);
  assert.match(fingerprint, /^[0-9a-f]{64}$/);
});

test('createBackupEncryptionService reports encryption unavailable when no key is provided', () => {
  const service = createBackupEncryptionService({ encryptionKey: null });
  assert.equal(service.isEncryptionAvailable(), false);
  assert.equal(service.getKeyFingerprint(), null);
});

test('createBackupEncryptionService reports encryption available when key is provided', () => {
  const key = generateTestKey();
  const service = createBackupEncryptionService({ encryptionKey: key });
  assert.equal(service.isEncryptionAvailable(), true);
  assert.equal(service.getKeyFingerprint(), computeKeyFingerprint(key));
});

test('encryptBackupPayload and decryptBackupPayload round-trip preserves original content', () => {
  const key = generateTestKey();
  const service = createBackupEncryptionService({ encryptionKey: key });
  const plaintext = JSON.stringify({ hello: 'world', nested: { value: 42 } });

  const encrypted = service.encryptBackupPayload(plaintext);
  const envelope = JSON.parse(encrypted);

  assert.equal(envelope.encrypted, true);
  assert.equal(typeof envelope.encryption.ciphertext, 'string');
  assert.equal(typeof envelope.encryption.iv, 'string');
  assert.equal(typeof envelope.encryption.tag, 'string');
  assert.equal(envelope.encryption.algorithm, 'aes-256-gcm');
  assert.equal(envelope.encryption.keyFingerprint, computeKeyFingerprint(key));

  const decrypted = service.decryptBackupPayload(encrypted);
  assert.equal(decrypted, plaintext);
});

test('encryptBackupPayload produces different ciphertext for the same plaintext due to random IV', () => {
  const key = generateTestKey();
  const service = createBackupEncryptionService({ encryptionKey: key });
  const plaintext = 'identical content';

  const first = service.encryptBackupPayload(plaintext);
  const second = service.encryptBackupPayload(plaintext);

  assert.notEqual(first, second);
  assert.notEqual(JSON.parse(first).encryption.iv, JSON.parse(second).encryption.iv);
});

test('detectAndDecrypt returns encrypted=false for plaintext JSON', () => {
  const service = createBackupEncryptionService({ encryptionKey: null });
  const plaintext = '{"formatVersion":"1","application":{}}';

  const result = service.detectAndDecrypt(plaintext);
  assert.equal(result.encrypted, false);
  assert.equal(result.keyFingerprint, null);
  assert.equal(result.decrypted, plaintext);
});

test('detectAndDecrypt decrypts encrypted envelope and returns fingerprint', () => {
  const key = generateTestKey();
  const service = createBackupEncryptionService({ encryptionKey: key });
  const plaintext = '{"formatVersion":"1","data":{}}';
  const encrypted = service.encryptBackupPayload(plaintext);

  const result = service.detectAndDecrypt(encrypted);
  assert.equal(result.encrypted, true);
  assert.equal(result.keyFingerprint, computeKeyFingerprint(key));
  assert.equal(result.decrypted, plaintext);
});

test('decryptBackupPayload throws when key is not configured', () => {
  const key = generateTestKey();
  const encryptService = createBackupEncryptionService({ encryptionKey: key });
  const decryptService = createBackupEncryptionService({ encryptionKey: null });
  const encrypted = encryptService.encryptBackupPayload('test');

  assert.throws(
    () => decryptService.decryptBackupPayload(encrypted),
    { message: /requires a configured encryption key/ },
  );
});

test('decryptBackupPayload throws when payload is not an encrypted envelope', () => {
  const key = generateTestKey();
  const service = createBackupEncryptionService({ encryptionKey: key });

  assert.throws(
    () => service.decryptBackupPayload('{"formatVersion":"1"}'),
    { message: /not in encrypted envelope format/ },
  );
});

test('decryptBackupPayload throws with tampered ciphertext (authentication failure)', () => {
  const key = generateTestKey();
  const service = createBackupEncryptionService({ encryptionKey: key });
  const encrypted = service.encryptBackupPayload('secret data');
  const envelope = JSON.parse(encrypted);

  const tamperedCiphertext = Buffer.from(envelope.encryption.ciphertext, 'base64url');
  tamperedCiphertext[0] ^= 0xff;
  envelope.encryption.ciphertext = tamperedCiphertext.toString('base64url');

  assert.throws(
    () => service.decryptBackupPayload(JSON.stringify(envelope)),
  );
});

test('decryptBackupPayload throws when key fingerprint does not match encryption key', () => {
  const key1 = generateTestKey();
  const key2 = generateTestKey();
  const encryptService = createBackupEncryptionService({ encryptionKey: key1 });
  const decryptService = createBackupEncryptionService({ encryptionKey: key2 });
  const encrypted = encryptService.encryptBackupPayload('test');

  assert.throws(
    () => decryptService.decryptBackupPayload(encrypted),
  );
});

test('encryptBackupPayload throws when key is not configured', () => {
  const service = createBackupEncryptionService({ encryptionKey: null });
  assert.throws(
    () => service.encryptBackupPayload('test'),
    { message: /requires a configured encryption key/ },
  );
});
