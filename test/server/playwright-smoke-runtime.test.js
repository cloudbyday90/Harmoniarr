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

test('browser smoke runtime uses the integration action timeout when available', () => {
  assert.equal(getBrowserDefaultTimeoutMs({ httpRequestTimeoutMs: 15_000 }), 15_000);
});

test('browser smoke runtime retains a bounded fallback action timeout', () => {
  assert.equal(getBrowserDefaultTimeoutMs(null), 10_000);
  assert.equal(getBrowserDefaultTimeoutMs({ httpRequestTimeoutMs: 0 }), 10_000);
});
