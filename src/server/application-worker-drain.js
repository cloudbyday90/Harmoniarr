/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { drainWorkerOwners } from './worker-owner-drain.js';

/** Capture owned workers; apply can enqueue scan work before its own completion. */
export function drainApplicationWorkerOwners({ importCandidateModule, libraryModule }) {
  return drainWorkerOwners([
    libraryModule?.libraryExternalIntakeWorker,
    libraryModule?.libraryDiscoveryWorker,
    importCandidateModule?.importCandidateExecutionWorker,
    importCandidateModule?.importCandidateMediaInspectionWorker,
    importCandidateModule?.importCandidateTranscodeWorker,
    importCandidateModule?.importCandidateApplyWorker,
    libraryModule?.libraryOrganizeApplyWorker,
    libraryModule?.libraryScanWorker,
  ]);
}
