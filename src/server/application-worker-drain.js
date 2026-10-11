/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { withWorkerTaskCleanup } from './worker-task-cleanup.js';

/** Capture concrete owners; apply can enqueue scan work before its own completion. */
export function drainApplyAndScanWorkers({ importCandidateModule, libraryModule }) {
  const apply = importCandidateModule?.importCandidateApplyWorker;
  const scan = libraryModule?.libraryScanWorker;
  return withWorkerTaskCleanup(() => apply?.close?.(), () => scan?.close?.());
}
