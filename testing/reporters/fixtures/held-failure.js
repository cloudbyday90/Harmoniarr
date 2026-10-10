/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';

test('private-test-name-canary', () => {
  process.stdout.write('private-stdout-canary\n');
  assert.equal('private-actual-canary', 'private-expected-canary', 'private-message-canary');
});

test('held case', async () => {
  const released = once(process, 'message');
  process.send({ state: 'held' });
  const [message] = await released;
  assert.equal(message, 'release');
  process.send({ state: 'released' });
  process.disconnect();
});
