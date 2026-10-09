/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';
import { createMusicQueueRecoveryStore } from './music-queue-recovery-store.js';
import { insertImportCandidateEvent } from './import-candidate-repository.js';

export function createMusicQueueRecoveryDiscoveryHandoffStore({ getPoolFn = getPool,
  recoveryStore = createMusicQueueRecoveryStore({ getPoolFn }) } = {}) {
  async function listSearchCandidates(sourceSearchId, queryable = null) {
    const result = await (queryable ?? getPoolFn()).query('SELECT id FROM import_candidates WHERE source_search_id=$1 ORDER BY id LIMIT 101', [sourceSearchId]);
    return Promise.all(result.rows.map((row) => recoveryStore.getCandidate(row.id, queryable)));
  }
  async function selectSearchCandidate({ candidate, context, failedCandidateId, discoveryRunId }, queryable) {
    const selected = await recoveryStore.selectCandidate({ candidate, context, failedCandidateId }, queryable);
    await insertImportCandidateEvent({ importCandidateId: candidate.id, eventType: 'import_candidate_selected',
      previousStatus: candidate.status, newStatus: 'selected', reason: 'High-confidence scoped recovery selection',
      details: { discoveryRunId } }, queryable);
    return selected;
  }
  async function saveContinuation({ runId, result, sourceSearchId }, queryable) {
    await queryable.query(`UPDATE operation_runs SET summary=jsonb_set(summary,'{musicQueueRecovery,continuation}',$2::jsonb)
      WHERE id=$1::uuid`, [runId, JSON.stringify({ sourceSearchId, result })]);
  }
  return { ...recoveryStore, listSearchCandidates, selectSearchCandidate, saveContinuation };
}
