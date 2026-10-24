/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { createOperationQueueStore } from '../../src/server/operation-queue-store.js';
import { createOperationQueueHandlers } from '../../src/server/operation-queue-handlers.js';

/** Claim through the real queue and await the registered worker's owned cleanup. */
export async function advanceBoundedSearch(f) {
  await f.pool.query("UPDATE operation_runs SET next_attempt_at=NOW() WHERE operation_type='quality_review_search' AND status='pending'");
  const run = await createOperationQueueStore({ getPoolFn: () => f.pool }).claimNextRunnableRun({ operationTypes: ['quality_review_search'] });
  assert.ok(run); const handlers = createOperationQueueHandlers({ libraryModule: f.libraryModule });
  const accepted = await handlers.quality_review_search({ run }); await accepted.completion;
}
