/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { withWorkerTaskCleanup } from './worker-task-cleanup.js';

/** Capture owned workers; apply can enqueue scan work before its own completion. */
export function drainApplicationWorkerOwners({ importCandidateModule, libraryModule }) {
  const execution = importCandidateModule?.importCandidateExecutionWorker;
  const apply = importCandidateModule?.importCandidateApplyWorker;
  const scan = libraryModule?.libraryScanWorker;
  return withWorkerTaskCleanup(() => execution?.close?.(),
    () => withWorkerTaskCleanup(() => apply?.close?.(), () => scan?.close?.()));
}
