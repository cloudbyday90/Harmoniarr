/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';

export async function runCanonicalNativeAudioExecution({ client, pool, module, fixture }) {
  const claimed = await createOperationQueueStore({ getPoolFn: () => pool }).claimNextRunnableRun({ operationTypes: ['import_candidate_execution_planning'] });
  assert.equal(claimed?.id, fixture.operationRunId);
  assert.equal(claimed.summary.selectedCandidateId, fixture.candidateId);
  const { completion } = await module.importCandidateExecutionWorker.startWorkerRun({ ...claimed.summary, runId: claimed.id });
  assert.ok(completion && typeof completion.then === 'function');
  await completion;
  const detail = await module.importCandidateExecutionSummaryService.buildImportCandidateExecutionRunDetail({ runId: claimed.id });
  assert.equal(detail.run.status, 'completed', JSON.stringify(detail));
  assert.equal(detail.run.items.length, 1);
  assert.equal(detail.run.items[0].planningSnapshot.execution.handoff.state, 'confirmed', JSON.stringify(detail));
  const root = '/api/v1/missing-music/decisions/' + fixture.wantedId;
  const refreshed = await client.requestJson(root);
  assert.equal(refreshed.response.status, 200);
  assert.equal(refreshed.payload.permissions.canViewDownloader, true, JSON.stringify(refreshed.payload));
  const handoff = await client.requestJson(root + '/downloader-handoff');
  assert.equal(handoff.response.status, 200, JSON.stringify(handoff.payload));
  assert.equal(handoff.payload.wantedReleaseId, fixture.wantedId);
  assert.equal(handoff.payload.requestedFor.username, fixture.owner.username);
  assert.deepEqual(Object.keys(handoff.payload).sort(), ['ok', 'decisionId', 'release', 'requestedFor', 'wantedReleaseId'].sort());
  return detail;
}
