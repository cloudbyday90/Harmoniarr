/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { getBrowserDefaultTimeoutMs } from '../../testing/browser/playwright-smoke-runtime.js';

test('browser smoke runtime uses its dedicated action timeout when available', () => {
  assert.equal(getBrowserDefaultTimeoutMs({ browserActionTimeoutMs: 28_000 }), 28_000);
});

test('browser smoke runtime retains a bounded fallback action timeout', () => {
  assert.equal(getBrowserDefaultTimeoutMs(null), 30_000);
  assert.equal(getBrowserDefaultTimeoutMs({ browserActionTimeoutMs: 0 }), 30_000);
});
