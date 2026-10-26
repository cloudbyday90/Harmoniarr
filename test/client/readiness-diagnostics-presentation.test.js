/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReadinessDiagnostics } from '../../src/client/lib/readiness-diagnostics-presentation.js';

test('readiness presentation caps history, labels observed facts and ignores private/unknown fields', () => {
  const row = { reference: '00000000-0000-4000-8000-000000000001', stage: 'activity_feed', code: '42P01', category: 'database_query',
    httpStatus: 500, observedAt: '2026-10-26T12:00:00Z', durationMs: 10, message: '/private secret' };
  const result = buildReadinessDiagnostics({ scope: 'process', failureCount: 100, lastCheck: { outcome: 'healthy' }, recentFailures: Array(30).fill(row) });
  assert.equal(result.failures.length, 16); assert.equal(result.outcome, 'Healthy'); assert.equal(result.failures[0].stage, 'Activity feed');
  assert.doesNotMatch(JSON.stringify(result), /private|secret/u); assert.equal(result.failures[0].code, '42P01');
});
test('unavailable and malformed readiness facts stay unknown without rendering arbitrary strings', () => {
  assert.equal(buildReadinessDiagnostics(null), null);
  const result = buildReadinessDiagnostics({ scope: 'process', failureCount: -1, recentFailures: [{ reference: 'secret', stage: '__proto__', category: 'secret', code: { toString: 'secret' }, httpStatus: 200 }] });
  assert.equal(result.failureCount, null); assert.equal(result.failures[0].code, 'Unavailable'); assert.equal(result.failures[0].stage, 'Unknown stage');
  assert.doesNotMatch(JSON.stringify(result), /secret/u);
});
