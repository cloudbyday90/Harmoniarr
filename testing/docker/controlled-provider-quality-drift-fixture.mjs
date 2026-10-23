/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { copyFile, readFile, writeFile } from 'node:fs/promises';

/** Prove preflight refusal, then change task-owned bytes after actual queue acceptance. */
export async function queueControlledQualityDrift({ candidateId, module, reconciliation, verifiedSourcePath }) {
  const refusal = reconciliation.autoApplyRuns[0];
  assert.equal(refusal?.started, false, 'strict preflight must refuse limited-bandwidth media');
  assert.equal(refusal.runId ?? null, null, 'preflight refusal must allocate no apply run');
  assert.equal(refusal.skippedReason, 'no_safe_import_pending_candidate');
  assert.equal((await module.importCandidateService.getImportCandidate({ importCandidateId: candidateId })).status, 'import_pending');
  const preview = await module.importCandidateApplyPreviewService.previewImportCandidateApply({ importCandidateId: candidateId });
  const sourcePath = preview.files[0]?.sourceFile?.path;
  assert.ok(sourcePath, 'the fixture needs its actual downloaded source');
  const original = await readFile(sourcePath);
  try {
    await copyFile(verifiedSourcePath, sourcePath);
    const admitted = await module.importCandidateAutoApplyRunService.startSafeApplyRunAfterDownloadCompleted({
      importCandidateId: candidateId, operationRunId: reconciliation.currentRunId });
    assert.ok(admitted.runId, 'valid task-owned bytes must pass the actual guarded queue boundary');
    return { autoApplyRuns: [admitted] };
  } finally {
    await writeFile(sourcePath, original);
    assert.deepEqual(await readFile(sourcePath), original, 'restore limited-bandwidth bytes before worker verification');
  }
}
