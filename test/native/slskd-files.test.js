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
import { nativeTransferFiles, nativeFileDigest } from '../../testing/slskd/native-file-data.js';
import { fingerprintPostgresCohortSource } from '../../testing/integration/postgres-cohort-policy.js';

test('isolated native slskd completes deterministic bytes and exact files through direct and lost-response batches', { timeout: 120_000 }, async t => {
  const source = await fingerprintPostgresCohortSource();
  const expectedVersion = process.env.HARMONIARR_NATIVE_SLSKD_VERSION ?? '0.26.1.0';
  const result = await withNativeSlskdProvider({ ...requireNativeSlskdImages(), signal: t.signal, mode: 'files', expectedVersion });
  assert.deepEqual(await fingerprintPostgresCohortSource(), source);
  assert.equal(result.complete, true); assert.equal(result.cleanupVerified, true);
  assert.deepEqual(result.storage, { sharedReadOnlyInspector: true, boundedTmpfs: true, bytesLimit: 4 * 1024 * 1024 });
  assert.equal(result.scenarios.length, 2);
  assert.ok(result.scenarios.every(row => row.posts === 1 && row.postStatus === 201 && row.receipts === 2
    && row.state === 'Completed, Succeeded' && row.exactReadsVerified));
  const published = result.scenarios.flatMap(row => row.publishedFiles).sort((a, b) => a.filename.localeCompare(b.filename));
  assert.equal(published.length, nativeTransferFiles.length);
  for (let index = 0; index < published.length; index++) {
    const file = nativeTransferFiles[index]; const actual = published[index];
    assert.equal(actual.filename, file.filename); assert.equal(actual.size, file.size);
    assert.equal(actual.sha256, nativeFileDigest(file)); assert.equal(actual.identityStable, true);
  }
  assert.equal(new Set(published.map(row => row.device + ':' + row.inode)).size, 4);
  assert.equal(result.fixture.logins, 1); assert.equal(result.fixture.peerConnections, 1);
  assert.equal(result.fixture.fileConnections, 4); assert.equal(result.fixture.refused, 0);
  assert.deepEqual(result.fixture.requests.sort(), nativeTransferFiles.map(file => file.filename).sort());
  assert.deepEqual(result.fixture.sentFiles.sort(), nativeTransferFiles.map(file => file.filename).sort());
  if (process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH) {
    await writeFile(process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH, JSON.stringify({ source, ...result }, null, 2), { flag: 'wx' });
  }
});
