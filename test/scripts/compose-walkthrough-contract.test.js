/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const COMPOSE_PATH = new URL('../../compose.walkthrough.yaml', import.meta.url);

test('walkthrough Compose provides a disposable local secret encryption key fallback', async () => {
  const source = await readFile(COMPOSE_PATH, 'utf8');

  const match = source.match(
    /HARMONIARR_SECRET_ENCRYPTION_KEY:\s*\$\{HARMONIARR_SECRET_ENCRYPTION_KEY:-([0-9a-f]{64})\}/u,
  );

  assert.ok(match, 'walkthrough Compose must set HARMONIARR_SECRET_ENCRYPTION_KEY with a 32-byte hex fallback');
  assert.notEqual(match[1], '0'.repeat(64), 'walkthrough fallback key must not be the all-zero key');
});
