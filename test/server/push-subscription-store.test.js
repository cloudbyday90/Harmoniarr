/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createPushSubscriptionStore } from '../../src/server/push/push-subscription-store.js';

const identity = Object.freeze({
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  registrationToken: '33333333-3333-4333-8333-333333333333',
  endpoint: 'https://push.example.test/registration',
});

test('incomplete registration identities cannot reach the database', async () => {
  const store = createPushSubscriptionStore({ getPoolFn: () => {
    assert.fail('Invalid identity must not acquire a database connection');
  } });
  for (const input of [undefined, null, {}, ...Object.keys(identity).flatMap((key) => [
    { ...identity, [key]: undefined }, { ...identity, [key]: '' }, { ...identity, [key]: 1 },
  ]), ...['id', 'userId', 'registrationToken'].map((key) => ({ ...identity, [key]: 'invalid' }))]) {
    assert.equal(await store.invalidateSubscriptionRegistration(input), false);
  }
});
