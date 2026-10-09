/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createImportExecutionOriginStore } from './import-execution-origin-store.js';
import { createImportCandidateDownloadAdoptionStore } from './import-candidate-download-adoption-store.js';

/** Compose existing current-account/policy reads with the narrow origin owner. */
export function createImportCandidateDownloadOriginStore({ getPoolFn } = {}) {
  const authority = createImportCandidateDownloadAdoptionStore({ getPoolFn });
  return { ...createImportExecutionOriginStore({ getPoolFn }), getActor: authority.getActor,
    readParticipantPolicies: authority.readParticipantPolicies,
    lockParticipantReleases: authority.lockParticipantReleases,
    getDiscovery: authority.getDiscovery, findActiveSelection: authority.findActiveSelection };
}
