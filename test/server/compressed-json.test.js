/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { runCompressedJsonProbe } from '../../testing/server/compressed-json-probe.js';

test('production JSON parser drains trailing compressed bytes and survives subsequent requests', { timeout: 20_000 }, async () => {
  assert.deepEqual(await runCompressedJsonProbe(), { deflateTrailing: 200, gzipTrailing: 200, gzipValid: 200, health: 200 });
});
