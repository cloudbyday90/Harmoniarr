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
import { nativePartialPlans } from '../../testing/slskd/native-partial-plan.js';
import { runNativePartialScenario } from '../../testing/slskd/native-partial-runner.js';
import { fingerprintPostgresCohortSource } from '../../testing/integration/postgres-cohort-policy.js';

test('native EOF and reset preserve only incomplete prefixes and never succeed or recover as completed work', { timeout: 120_000 }, async t => {
  const source = await fingerprintPostgresCohortSource();
  const result = await withNativeSlskdProvider({ ...requireNativeSlskdImages(), signal: t.signal, mode: 'partial',
    expectedVersion: process.env.HARMONIARR_NATIVE_SLSKD_VERSION ?? '0.26.1.0', runScenario: runNativePartialScenario });
  assert.deepEqual(await fingerprintPostgresCohortSource(), source);
  assert.equal(result.complete, true); assert.equal(result.cleanupVerified, true); assert.equal(result.scenarios.length, 3);
  assert.equal(result.nativeDownloadsRetired, true); assert.equal(result.providerStoppedBeforeInspection, true);
  assert.equal(result.storage.incompleteReadOnlyInspector, true); assert.equal(result.storage.incompleteBytesLimit, 4194304);
  assert.equal(result.filesystem.failedCompletedFilesAbsent, true); assert.equal(result.filesystem.exactTreesVerified, true);
  assert.equal(result.filesystem.completed.length, 1); assert.equal(result.filesystem.incomplete.length, 2);
  assert.equal(result.fixture.fileConnections, 3); assert.equal(result.fixture.refused, 0);
  assert.deepEqual(result.fixture.requests.sort(), nativePartialPlans.map(plan => plan.file.filename).sort());
  assert.deepEqual(result.fixture.sentFiles, [nativePartialPlans[0].file.filename]);
  assert.equal(result.fixture.partialFiles.length, 2);
  const reset = result.fixture.partialFiles.find(row => row.kind === 'reset');
  assert.ok(reset.checkpointBytes >= 16_384 && reset.checkpointBytes <= reset.emittedBytes);
  assert.equal(result.scenarios.find(row => row.kind === 'reset').lostResponse, true);
  if (process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH) {
    await writeFile(process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH, JSON.stringify({ source, ...result }, null, 2), { flag: 'wx' });
  }
});
