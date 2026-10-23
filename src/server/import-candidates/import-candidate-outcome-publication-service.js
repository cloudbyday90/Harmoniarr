/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { withDatabasePublicationScope } from '../database-publication-scope.js';
import { createTrustSnapshotStore } from '../recovery/trust-snapshot-store.js';
import { createSourceUserOutcomeLedgerStore } from '../activity/source-user-outcome-ledger-store.js';
import { createSourceUserTrustEvidenceService } from '../activity/source-user-trust-evidence-service.js';

/** Standalone composition also borrows the producer transaction, never a second pool client. */
function createDefaultRecorder() {
  return createSourceUserTrustEvidenceService({ ...createTrustSnapshotStore(),
    appendOutcomeEventFn: createSourceUserOutcomeLedgerStore().appendOutcomeEvent }).recordSourceUserOutcomeEvidence;
}

export function createImportCandidateOutcomePublisher({ recordOutcome = createDefaultRecorder() } = {}) {
  return async function publish({ candidate, event, queryable, outcome, qualityLabel = null, qualityWeight = 1 }) {
    if (!event?.id || !candidate?.username || typeof recordOutcome !== 'function') {
      throw new TypeError('Durable candidate outcome publication is required');
    }
    return withDatabasePublicationScope({ queryable, kind: 'import_candidate_event', ownerId: event.id }, async owned => {
      const result = await recordOutcome({ id: event.id, actorUserId: event.actorUserId ?? null,
        eventType: event.eventType, occurredAt: event.occurredAt, reason: event.reason ?? null,
        username: candidate.username, outcome, qualityLabel, qualityWeight, queryable: owned });
      if (result?.recorded !== true) throw new Error('Candidate outcome event was not recorded');
      return result;
    });
  };
}

export async function settleCandidateOutcomeAdvisory(publication) {
  try { await publication?.afterCommit?.(); }
  catch { /* Advisory delivery cannot undo committed evidence. */ }
}
