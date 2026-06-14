/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALLOW_EPHEMERAL_VAPID_KEYS_ENV,
  DEFAULT_VAPID_CONTACT,
  VAPID_CONTACT_ENV,
  VAPID_PRIVATE_KEY_ENV,
  VAPID_PUBLIC_KEY_ENV,
  generateVapidKeyPair,
  resolveVapidContactFromEnv,
  resolveOrGenerateVapidKeys,
  resolveVapidKeysFromEnv,
} from '../../src/server/push/vapid-keys.js';

// ── generateVapidKeyPair ──────────────────────────────────────────────────────

test('generateVapidKeyPair: calls the provided generate function', (t) => {
  const generated = { publicKey: 'pub-key', privateKey: 'priv-key' };
  const generateFn = t.mock.fn(() => generated);

  const result = generateVapidKeyPair({ generateFn });

  assert.equal(generateFn.mock.callCount(), 1);
  assert.deepEqual(result, generated);
});

test('generateVapidKeyPair: returns the result from the generate function', () => {
  const expected = { publicKey: 'some-public', privateKey: 'some-private' };
  const result = generateVapidKeyPair({ generateFn: () => expected });
  assert.deepEqual(result, expected);
});

// ── resolveVapidKeysFromEnv ───────────────────────────────────────────────────

test('resolveVapidKeysFromEnv: returns keys when both env vars are present', () => {
  const env = {
    [VAPID_PUBLIC_KEY_ENV]: 'pub-key',
    [VAPID_PRIVATE_KEY_ENV]: 'priv-key',
  };

  const result = resolveVapidKeysFromEnv({ env });

  assert.deepEqual(result, { publicKey: 'pub-key', privateKey: 'priv-key' });
});

test('resolveVapidKeysFromEnv: trims whitespace from key values', () => {
  const env = {
    [VAPID_PUBLIC_KEY_ENV]: '  pub-key  ',
    [VAPID_PRIVATE_KEY_ENV]: '  priv-key  ',
  };

  const result = resolveVapidKeysFromEnv({ env });

  assert.deepEqual(result, { publicKey: 'pub-key', privateKey: 'priv-key' });
});

test('resolveVapidKeysFromEnv: returns null when public key is missing', () => {
  const env = { [VAPID_PRIVATE_KEY_ENV]: 'priv-key' };
  const result = resolveVapidKeysFromEnv({ env });
  assert.equal(result, null);
});

test('resolveVapidKeysFromEnv: returns null when private key is missing', () => {
  const env = { [VAPID_PUBLIC_KEY_ENV]: 'pub-key' };
  const result = resolveVapidKeysFromEnv({ env });
  assert.equal(result, null);
});

test('resolveVapidKeysFromEnv: returns null when both keys are missing', () => {
  const result = resolveVapidKeysFromEnv({ env: {} });
  assert.equal(result, null);
});

test('resolveVapidKeysFromEnv: returns null when public key is empty string', () => {
  const env = {
    [VAPID_PUBLIC_KEY_ENV]: '',
    [VAPID_PRIVATE_KEY_ENV]: 'priv-key',
  };
  assert.equal(resolveVapidKeysFromEnv({ env }), null);
});

test('resolveVapidKeysFromEnv: returns null when private key is whitespace only', () => {
  const env = {
    [VAPID_PUBLIC_KEY_ENV]: 'pub-key',
    [VAPID_PRIVATE_KEY_ENV]: '   ',
  };
  assert.equal(resolveVapidKeysFromEnv({ env }), null);
});

// ── resolveOrGenerateVapidKeys ────────────────────────────────────────────────

test('resolveOrGenerateVapidKeys: returns env keys without calling generateFn when both are set', (t) => {
  const env = {
    [VAPID_PUBLIC_KEY_ENV]: 'env-pub',
    [VAPID_PRIVATE_KEY_ENV]: 'env-priv',
  };
  const generateFn = t.mock.fn(() => ({ publicKey: 'gen-pub', privateKey: 'gen-priv' }));
  const stderr = { write: t.mock.fn() };

  const result = resolveOrGenerateVapidKeys({ env, generateFn, stderr });

  assert.deepEqual(result, { publicKey: 'env-pub', privateKey: 'env-priv' });
  assert.equal(generateFn.mock.callCount(), 0);
  assert.equal(stderr.write.mock.callCount(), 0);
});

test('resolveOrGenerateVapidKeys: generates keys and writes warning when env vars are missing', (t) => {
  const generated = { publicKey: 'gen-pub', privateKey: 'gen-priv' };
  const generateFn = t.mock.fn(() => generated);
  const stderr = { write: t.mock.fn() };

  const result = resolveOrGenerateVapidKeys({ env: { NODE_ENV: 'test' }, generateFn, stderr });

  assert.deepEqual(result, generated);
  assert.equal(generateFn.mock.callCount(), 1);
  assert.ok(stderr.write.mock.callCount() > 0, 'should write warning to stderr');
});

test('resolveOrGenerateVapidKeys: warning does not leak generated key material', (t) => {
  const generated = { publicKey: 'THE-PUB-KEY', privateKey: 'THE-PRIV-KEY' };
  const lines = [];
  const stderr = { write: (msg) => lines.push(msg) };

  resolveOrGenerateVapidKeys({ env: { NODE_ENV: 'test' }, generateFn: () => generated, stderr });

  const combined = lines.join('');
  assert.ok(!combined.includes('THE-PUB-KEY'), 'warning must not include generated public key');
  assert.ok(!combined.includes('THE-PRIV-KEY'), 'warning must not include generated private key');
  assert.ok(combined.includes('npm run generate:vapid-keys'), 'warning should point to the generator');
});

test('resolveOrGenerateVapidKeys: throws in production when keys are missing', (t) => {
  const generateFn = t.mock.fn(() => ({ publicKey: 'gen-pub', privateKey: 'gen-priv' }));
  const stderr = { write: t.mock.fn() };

  assert.throws(
    () => resolveOrGenerateVapidKeys({ env: { NODE_ENV: 'production' }, generateFn, stderr }),
    /VAPID keys are required/,
  );
  assert.equal(generateFn.mock.callCount(), 0);
  assert.equal(stderr.write.mock.callCount(), 0);
});

test('resolveOrGenerateVapidKeys: honours explicit non-production ephemeral-key opt-out', (t) => {
  const generateFn = t.mock.fn(() => ({ publicKey: 'gen-pub', privateKey: 'gen-priv' }));
  const stderr = { write: t.mock.fn() };

  assert.throws(
    () => resolveOrGenerateVapidKeys({
      env: {
        [ALLOW_EPHEMERAL_VAPID_KEYS_ENV]: 'false',
        NODE_ENV: 'test',
      },
      generateFn,
      stderr,
    }),
    /VAPID keys are required/,
  );
  assert.equal(generateFn.mock.callCount(), 0);
});

test('resolveOrGenerateVapidKeys: rejects invalid ephemeral-key opt-out value', () => {
  assert.throws(
    () => resolveOrGenerateVapidKeys({
      env: {
        [ALLOW_EPHEMERAL_VAPID_KEYS_ENV]: 'sometimes',
        NODE_ENV: 'test',
      },
      generateFn: () => ({ publicKey: 'gen-pub', privateKey: 'gen-priv' }),
      stderr: { write: () => {} },
    }),
    /HARMONIARR_ALLOW_EPHEMERAL_VAPID_KEYS/,
  );
});

// ── resolveVapidContactFromEnv ────────────────────────────────────────────────

test('resolveVapidContactFromEnv: returns configured mailto contact', () => {
  assert.equal(
    resolveVapidContactFromEnv({
      env: { [VAPID_CONTACT_ENV]: 'mailto:ops@example.com' },
    }),
    'mailto:ops@example.com',
  );
});

test('resolveVapidContactFromEnv: returns configured https contact', () => {
  assert.equal(
    resolveVapidContactFromEnv({
      env: { [VAPID_CONTACT_ENV]: 'https://example.com/security' },
    }),
    'https://example.com/security',
  );
});

test('resolveVapidContactFromEnv: trims configured contact', () => {
  assert.equal(
    resolveVapidContactFromEnv({
      env: { [VAPID_CONTACT_ENV]: '  mailto:ops@example.com  ' },
    }),
    'mailto:ops@example.com',
  );
});

test('resolveVapidContactFromEnv: uses default contact outside production', () => {
  assert.equal(resolveVapidContactFromEnv({ env: { NODE_ENV: 'test' } }), DEFAULT_VAPID_CONTACT);
});

test('resolveVapidContactFromEnv: rejects default contact in production', () => {
  assert.throws(
    () => resolveVapidContactFromEnv({ env: { NODE_ENV: 'production' } }),
    /VAPID_CONTACT must be configured/,
  );
});

test('resolveVapidContactFromEnv: rejects unsupported contact schemes', () => {
  assert.throws(
    () => resolveVapidContactFromEnv({ env: { [VAPID_CONTACT_ENV]: 'ftp://example.com' } }),
    /mailto: or https:/,
  );
});
