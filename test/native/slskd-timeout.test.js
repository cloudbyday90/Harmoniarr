/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import test from 'node:test';
import { requireNativeSlskdImages, withNativeSlskdProvider } from '../../testing/slskd/native-provider-runtime.js';
import { runNativeTimeoutScenario } from '../../testing/slskd/native-timeout-runner.js';
import { nativeTimeoutFile } from '../../testing/slskd/fixture-data.js';
import { fingerprintPostgresCohortSource } from '../../testing/integration/postgres-cohort-policy.js';

test('released native enqueue timeout retires internal work before an explicitly requested new batch', { timeout: 270_000 }, async t => {
  const source = await fingerprintPostgresCohortSource();
  const expectedVersion = process.env.HARMONIARR_NATIVE_SLSKD_VERSION;
  assert.ok(['0.26.0.0', '0.26.1.0'].includes(expectedVersion));
  const result = await withNativeSlskdProvider({ ...requireNativeSlskdImages(), signal: t.signal,
    mode: 'cancellation', expectedVersion,
    runScenario: context => runNativeTimeoutScenario({ ...context, signal: t.signal }) });
  assert.deepEqual(await fingerprintPostgresCohortSource(), source);
  assert.equal(result.complete, true); assert.equal(result.cleanupVerified, true);
  assert.equal(result.rawVersion, expectedVersion);
  const candidate = expectedVersion === '0.26.1.0';
  assert.equal(candidate ? result.internalRetirementVerified : result.retryBlocked, true);
  assert.equal(result.fixture.logins, 1); assert.equal(result.fixture.refused, 0);
  assert.deepEqual(result.fixture.requests, Array(candidate ? 2 : 1).fill(nativeTimeoutFile.filename));
  if (process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH) {
    await writeFile(process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH, JSON.stringify({ source, ...result }, null, 2), { flag: 'wx' });
  }
});
