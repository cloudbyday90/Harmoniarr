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
import { nativeRefusalPlans } from '../../testing/slskd/native-refusal-policy.js';
import { nativeFileDigest } from '../../testing/slskd/native-file-data.js';
import { runNativeRefusalScenario } from '../../testing/slskd/native-refusal-runner.js';
import { fingerprintPostgresCohortSource } from '../../testing/integration/postgres-cohort-policy.js';

test('native default exhaustion and changed-size refusal remain failed with incomplete-only bytes and one application POST', { timeout: 150_000 }, async t => {
  const source = await fingerprintPostgresCohortSource();
  const result = await withNativeSlskdProvider({ ...requireNativeSlskdImages(), signal: t.signal, mode: 'refusal',
    expectedVersion: '0.26.1.0', runScenario: runNativeRefusalScenario });
  assert.deepEqual(await fingerprintPostgresCohortSource(), source);
  assert.equal(result.complete, true); assert.equal(result.cleanupVerified, true);
  assert.equal(result.nativeDownloadsRetired, true); assert.equal(result.providerStoppedBeforeInspection, true);
  assert.equal(result.storage.incompleteReadOnlyInspector, true); assert.equal(result.storage.incompleteBytesLimit, 4194304);
  assert.equal(result.filesystem.completedFilesAbsent, true); assert.equal(result.filesystem.exactTreesVerified, true);
  assert.equal(result.fixture.fileConnections, 4); assert.equal(result.fixture.requests.length, 5); assert.equal(result.fixture.refused, 0);
  assert.equal(result.fixture.refusalFiles.length, 4); assert.equal(result.fixture.changedSizeResponses.length, 1);
  assert.equal(result.fixture.sentFiles.length, 0);
  for (const plan of nativeRefusalPlans) {
    const file = result.filesystem.incomplete.find(row => row.filename === plan.partial.file.filename);
    assert.equal(file.identityStable, true); assert.ok(file.size >= 16384 && file.size <= plan.partial.bytes);
    assert.equal(file.sha256, nativeFileDigest(plan.partial.file, file.size));
  }
  const exhaustion = result.fixture.refusalFiles.filter(row => row.kind === 'exhaustion');
  assert.deepEqual(exhaustion.map(row => row.attempt), [1, 2, 3]);
  for (const row of exhaustion.slice(1)) {
    assert.equal(row.offset, nativeRefusalPlans[0].partial.bytes); assert.equal(row.emittedBytes, 0);
    assert.equal(row.prefixIdentityStable, true); assert.equal(row.prefixSha256, nativeFileDigest(nativeRefusalPlans[0].partial.file, row.offset));
  }
  const changed = result.fixture.changedSizeResponses[0];
  assert.equal(changed.attempt, 2); assert.equal(changed.advertisedSize, changed.expectedSize + 1);
  assert.deepEqual(result.scenarios.map(row => row.nativeAttempts), [3, 2]);
  assert.equal(result.scenarios[1].sizeMismatchVerified, true);
  if (process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH) {
    await writeFile(process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH, JSON.stringify({ source, ...result }, null, 2), { flag: 'wx' });
  }
});
