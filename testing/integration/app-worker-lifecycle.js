/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';

/** Drain this application's apply owner without replacing an original scenario failure. */
export function withIntegrationAppWorkerDrain({ application, phaseObserver }, run) {
  return withWorkerTaskCleanup(run, () => phaseObserver.measure('app_worker_drain',
    () => application.importCandidateModule?.importCandidateApplyWorker?.close?.()));
}
