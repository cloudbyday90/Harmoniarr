/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { withWorkerTaskCleanup } from './worker-task-cleanup.js';

/** Drain admitted renewal, then attempt the captured lease release despite failure. */
export function drainWorkerLease({ heartbeat, lease, releaseLease, runId, status }) {
  return withWorkerTaskCleanup(
    () => heartbeat?.stopAndDrain ? heartbeat.stopAndDrain() : heartbeat?.stop(),
    () => lease ? releaseLease({ runId, status, expectedLease: lease }) : undefined,
  );
}
