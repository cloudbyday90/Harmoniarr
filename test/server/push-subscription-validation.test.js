/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePushEndpoint } from '../../src/server/push/push-endpoint-policy.js';
import { validatePushSubscription } from '../../src/server/push/push-subscription-validation.js';
import { createPushSubscriptionKeys } from '../../testing/push-subscription-fixtures.js';

const keys = createPushSubscriptionKeys();
const endpoint = 'https://Push.Example.com:443/a%2Fb?token=x%2By&z=2&z=1';

test('valid browser subscription preserves exact capability and key strings', () => {
  const input = { endpoint, ...keys };
  assert.deepEqual(validatePushSubscription(input), input);
  assert.equal(parsePushEndpoint(endpoint).hostname, 'push.example.com');
});

test('push endpoint policy rejects ambiguous, local, literal, oversized and nonstandard destinations', () => {
  const rejected = [null, {}, '', ' https://push.example.com/x', 'https://push.example.com/x ',
    'https://push.example.com/\nprivate', 'http://push.example.com/x', '//push.example.com/x',
    'https://user:secret@push.example.com/x', 'https://push.example.com/x#',
    'https://push.example.com:8443/x', 'https://push.example.com:0443/x',
    'https://127.0.0.1/x', 'https://127.1/x', 'https://2130706433/x', 'https://0x7f000001/x',
    'https://0177.0.0.1/x', 'https://[::1]/x', 'https://[::ffff:127.0.0.1]/x',
    'https://localhost/x', 'https://push.local/x', 'https://push.internal/x', 'https://push.arpa/x',
    'https://push.example.com./x', 'https://push..example.com/x', 'https://-push.example.com/x',
    'https://%70ush.example.com/x', 'https://push_example.com/x',
    'https://push.example.com' + String.fromCharCode(92) + '@evil.example.com/x',
    'https://push.example.com/' + 'x'.repeat(4096),
    'https://push.example.com/' + 'é'.repeat(2040)];
  for (const value of rejected) assert.throws(() => parsePushEndpoint(value), { code: 'push_endpoint_invalid' });
  const prefix = 'https://push.example.com/';
  assert.ok(parsePushEndpoint(prefix + 'x'.repeat(4096 - prefix.length)));
});

test('push subscription keys require canonical base64url and a real uncompressed P-256 point', () => {
  const invalidPoint = Buffer.alloc(65); invalidPoint[0] = 4;
  for (const overrides of [
    { p256dh: invalidPoint.toString('base64url') }, { p256dh: Buffer.alloc(65, 3).toString('base64url') },
    { p256dh: keys.p256dh + '=' }, { p256dh: keys.p256dh.slice(0, -1) },
    { p256dh: 'A'.repeat(100000) }, { auth: keys.auth + '==' }, { auth: 'A'.repeat(21) },
    { auth: keys.auth.slice(0, -1) + 'x' }, { auth: keys.auth + ' ' },
    { auth: Buffer.alloc(17).toString('base64url') }, { auth: '+'.repeat(22) }, { auth: null },
  ]) assert.throws(() => validatePushSubscription({ endpoint, ...keys, ...overrides }), {
    code: 'push_subscription_invalid', message: 'Push subscription endpoint or encryption keys are invalid',
  });
});
