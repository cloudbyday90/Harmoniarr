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
import { nativeResumePlans } from '../../testing/slskd/native-resume-policy.js';
import { nativeFileDigest } from '../../testing/slskd/native-file-data.js';
import { runNativeResumeScenario } from '../../testing/slskd/native-resume-runner.js';
import { fingerprintPostgresCohortSource } from '../../testing/integration/postgres-cohort-policy.js';

test('native default retries resume exact partial offsets with one application POST and stable successful receipts', { timeout: 150_000 }, async t => {
  const source = await fingerprintPostgresCohortSource();
  const result = await withNativeSlskdProvider({ ...requireNativeSlskdImages(), signal: t.signal, mode: 'resume',
    expectedVersion: '0.26.1.0', runScenario: runNativeResumeScenario });
  assert.deepEqual(await fingerprintPostgresCohortSource(), source);
  assert.equal(result.complete, true); assert.equal(result.cleanupVerified, true);
  assert.equal(result.nativeDownloadsRetired, true); assert.equal(result.providerStoppedBeforeInspection, true);
  assert.equal(result.storage.incompleteReadOnlyInspector, true); assert.equal(result.storage.incompleteBytesLimit, 4194304);
  assert.equal(result.filesystem.incompleteFilesAbsent, true); assert.equal(result.filesystem.exactTreesVerified, true);
  assert.equal(result.fixture.fileConnections, 4); assert.equal(result.fixture.requests.length, 4); assert.equal(result.fixture.refused, 0);
  assert.equal(result.fixture.partialFiles.length, 2); assert.equal(result.fixture.resumeFiles.length, 2);
  for (const plan of nativeResumePlans) {
    const full = result.filesystem.completed.find(row => row.filename === plan.file.filename);
    const resume = result.fixture.resumeFiles.find(row => row.filename === plan.file.filename);
    assert.equal(full.size, plan.file.size); assert.equal(full.sha256, nativeFileDigest(plan.file)); assert.equal(full.identityStable, true);
    assert.ok(resume.offset >= 16384 && resume.offset <= plan.bytes); assert.equal(resume.emittedBytes, plan.file.size - resume.offset);
    assert.equal(resume.prefixSha256, nativeFileDigest(plan.file, resume.offset)); assert.equal(resume.prefixIdentityStable, true);
  }
  assert.equal(result.fixture.resumeFiles.find(row => row.filename === nativeResumePlans[0].file.filename).emittedBytes, 1);
  if (process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH) {
    await writeFile(process.env.HARMONIARR_NATIVE_SLSKD_EVIDENCE_PATH, JSON.stringify({ source, ...result }, null, 2), { flag: 'wx' });
  }
});
