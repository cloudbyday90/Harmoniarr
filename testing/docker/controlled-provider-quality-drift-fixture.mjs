/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { copyFile, readFile, writeFile } from 'node:fs/promises';

/** Prove preflight refusal, then change task-owned bytes after actual queue acceptance. */
export async function queueControlledQualityDrift({ candidateId, module, reconciliation, verifiedSourcePath,
  fixture, authorityFixtures, libraryModule, pool, executeDownloadAndReconcile }) {
  const refusal = reconciliation.autoApplyRuns[0];
  assert.equal(refusal?.started, false, 'strict preflight must refuse limited-bandwidth media');
  assert.equal(refusal.runId ?? null, null, 'preflight refusal must allocate no apply run');
  assert.equal(refusal.skippedReason, 'no_safe_import_pending_candidate');
  assert.equal((await module.importCandidateService.getImportCandidate({ importCandidateId: candidateId })).status, 'failed');
  const stop = (await pool.query(`SELECT details FROM import_candidate_events WHERE import_candidate_id=$1
    AND event_type='import_candidate_import_blocked'`, [candidateId])).rows;
  assert.equal(stop.length, 1); assert.equal(stop[0].details.addBlockerCode, 'media_verification');
  assert.equal(stop[0].details.recoveryReasonCode, 'suspicious_lossless');
  assert.equal((await pool.query('SELECT id FROM import_apply_run_items WHERE import_candidate_id=$1', [candidateId])).rowCount, 0);
  const preview = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: candidateId });
  const sourcePath = preview.files[0]?.sourceFile?.path;
  assert.ok(sourcePath, 'the fixture needs its actual downloaded source');
  const original = await readFile(sourcePath);
  // A distinct current acquisition tests worker drift; the rejected recipient is never reopened.
  const owner = await authorityFixtures.createSingleDiscovery({ ...fixture, id: `${fixture.id}-${randomUUID()}` });
  const dispatch = await libraryModule.libraryDiscoveryDispatchService.dispatchReadyDiscoveryRequests();
  const search = dispatch.dispatchedSearches[0];
  assert.equal(search.metadataReleaseId, owner.metadataReleaseId);
  const nextCandidateId = search.autoSelection.selectedCandidateId;
  try {
    const admitted = await executeDownloadAndReconcile({ importCandidateModule: module, runId: search.autoDownloadStart.runId,
      beforeReconcile: () => copyFile(verifiedSourcePath, sourcePath) });
    assert.ok(admitted.autoApplyRuns[0]?.runId, 'valid task-owned bytes must pass the actual guarded queue boundary');
    return { ...admitted, candidateId: nextCandidateId, owner, preflightReviewRecorded: true };
  } finally {
    await writeFile(sourcePath, original);
    assert.deepEqual(await readFile(sourcePath), original, 'restore limited-bandwidth bytes before worker verification');
  }
}
