/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import { createOperatorArtistReconciliationWorker } from '../../src/server/metadata/operator-artist-reconciliation-worker.js';
import { createOperatorArtistReconciliationExecutionService } from '../../src/server/metadata/operator-artist-reconciliation-execution-service.js';
import { createOperatorArtistReconciliationRequestService } from '../../src/server/metadata/operator-artist-reconciliation-request-service.js';
import { createOperatorArtistReconciliationRunStore } from '../../src/server/metadata/operator-artist-reconciliation-run-store.js';
import { createLibraryDiscoveryRequestService } from '../../src/server/library/library-discovery-request-service.js';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { readOperatorReconciliationLifetimeState } from './operator-reconciliation-lifetime-fixture.js';

export async function executeOperatorReconciliationFixtureRun(run, {
  transformDesiredReleases = releases => releases,
  beforeMaterialize = async () => {},
} = {}) {
  const requests = createOperatorArtistReconciliationRequestService({
    reconcileDiscoveryRequests: createLibraryDiscoveryRequestService().reconcileDiscoveryRequests,
  });
  let captured;
  let desiredReleases;
  const execution = createOperatorArtistReconciliationExecutionService({
    operatorArtistReconciliationRequestService: {
      materializeDesiredReleaseRequests: async input => {
        captured = structuredClone(input.publicationSource);
        desiredReleases = structuredClone(input.desiredReleases);
        await beforeMaterialize(input);
        return requests.materializeDesiredReleaseRequests({ ...input,
          desiredReleases: transformDesiredReleases(input.desiredReleases) });
      },
    },
  });
  const worker = createOperatorArtistReconciliationWorker({
    ...createOperatorArtistReconciliationRunStore(),
    executeOperatorArtistReconciliation: execution.executeOperatorArtistReconciliation,
  });
  try {
    const claimed = await createOperationQueueStore().claimNextRunnableRun({
      operationTypes: ['operator_artist_reconciliation'],
    });
    assert.equal(claimed?.id, run.id);
    const { completion } = await worker.startWorkerRun({ ...run, runId: run.id });
    await completion;
  } finally {
    await worker.close();
  }
  return { captured, desiredReleases, state: await readOperatorReconciliationLifetimeState(run.id) };
}
