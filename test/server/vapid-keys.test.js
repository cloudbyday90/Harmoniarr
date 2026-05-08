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
  VAPID_PRIVATE_KEY_ENV,
  VAPID_PUBLIC_KEY_ENV,
  generateVapidKeyPair,
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

  const result = resolveOrGenerateVapidKeys({ env: {}, generateFn, stderr });

  assert.deepEqual(result, generated);
  assert.equal(generateFn.mock.callCount(), 1);
  assert.ok(stderr.write.mock.callCount() > 0, 'should write warning to stderr');
});

test('resolveOrGenerateVapidKeys: warning includes the generated public key', (t) => {
  const generated = { publicKey: 'THE-PUB-KEY', privateKey: 'THE-PRIV-KEY' };
  const lines = [];
  const stderr = { write: (msg) => lines.push(msg) };

  resolveOrGenerateVapidKeys({ env: {}, generateFn: () => generated, stderr });

  const combined = lines.join('');
  assert.ok(combined.includes('THE-PUB-KEY'), 'warning should include public key');
  assert.ok(combined.includes(VAPID_PUBLIC_KEY_ENV), 'warning should name the env var');
});

test('resolveOrGenerateVapidKeys: warning includes the generated private key', (t) => {
  const generated = { publicKey: 'PUB', privateKey: 'THE-PRIV-KEY' };
  const lines = [];
  const stderr = { write: (msg) => lines.push(msg) };

  resolveOrGenerateVapidKeys({ env: {}, generateFn: () => generated, stderr });

  const combined = lines.join('');
  assert.ok(combined.includes('THE-PRIV-KEY'), 'warning should include private key');
  assert.ok(combined.includes(VAPID_PRIVATE_KEY_ENV), 'warning should name the env var');
});
