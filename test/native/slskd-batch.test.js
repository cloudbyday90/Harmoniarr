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
import { nativeFiles } from '../../testing/slskd/fixture-data.js';
import { fingerprintPostgresCohortSource } from '../../testing/integration/postgres-cohort-policy.js';

test('isolated native slskd accepts exact batches and recovers completed response loss without another POST', { timeout: 120_000 }, async t => {
  const source = await fingerprintPostgresCohortSource();
  const expectedVersion = process.env.HARMONIARR_NATIVE_SLSKD_VERSION ?? '0.26.0.0';
  const result = await withNativeSlskdProvider({ ...requireNativeSlskdImages(), signal: t.signal, expectedVersion });
  assert.deepEqual(await fingerprintPostgresCohortSource(), source);
  assert.equal(result.complete, true); assert.equal(result.cleanupVerified, true);
  assert.equal(result.scenarios.length, 2);
  assert.ok(result.scenarios.every(row => row.posts === 1 && row.postStatus === 201 && row.receipts === 2));
  assert.equal(result.fixture.logins, 1); assert.ok(result.fixture.addresses >= 1);
  assert.equal(result.fixture.peerConnections, 1); assert.equal(result.fixture.refused, 0);
  assert.deepEqual(result.fixture.requests.sort(), nativeFiles.map(file => file.filename).sort());
  if (process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH) {
    await writeFile(process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH, JSON.stringify({ source, ...result }, null, 2), { flag: 'wx' });
  }
});
