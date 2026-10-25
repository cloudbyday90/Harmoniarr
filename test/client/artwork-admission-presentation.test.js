/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { formatDiagnosticMiB } from '../../src/client/lib/artwork-admission-presentation.js';

test('diagnostic binary units distinguish observed zero from unavailable values without coercion', () => {
  assert.equal(formatDiagnosticMiB(0), '0 MiB'); assert.equal(formatDiagnosticMiB(1350566688), '1,288 MiB');
  assert.equal(formatDiagnosticMiB(1024 ** 2 / 2), '0.5 MiB');
  assert.equal(formatDiagnosticMiB(800), '<0.1 MiB');
  for (const value of [null, undefined, -1, NaN, Infinity, '0', Number.MAX_SAFE_INTEGER + 1]) assert.equal(formatDiagnosticMiB(value), 'Unavailable');
});
