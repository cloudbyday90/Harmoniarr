/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { drainApplyAndScanWorkers } from '../../src/server/application-worker-drain.js';

/** Drain this application's apply/scan owners without replacing the scenario failure. */
export function withIntegrationAppWorkerDrain({ application, phaseObserver }, run) {
  return withWorkerTaskCleanup(run, () => phaseObserver.measure('app_worker_drain',
    () => drainApplyAndScanWorkers(application)));
}
