/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

test('private-test-name-canary', () => {
  process.stdout.write('private-stdout-canary\n');
  assert.equal('private-actual-canary', 'private-expected-canary', 'private-message-canary');
});

test('held case in an isolated worker', async (t) => {
  const response = await fetch(process.env.HARMONIARR_REPORTER_RELEASE_URL, { signal: t.signal });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'released');
});
