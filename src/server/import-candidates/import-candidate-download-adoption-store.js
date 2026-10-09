/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { getPool } from '../database.js';
import { createImportExecutionHandoffStore } from './import-execution-handoff-store.js';
import { createMusicQueueRecoveryStore } from './music-queue-recovery-store.js';
import { effectiveExecutionOriginSql } from './import-execution-origin-sql.js';

/** Adoption reads use the existing candidate and recipient owners; SQL stays here. */
export function createImportCandidateDownloadAdoptionStore({ getPoolFn = getPool } = {}) {
  const handoffStore = createImportExecutionHandoffStore({ getPoolFn });
  const recoveryStore = createMusicQueueRecoveryStore({ getPoolFn });
  const db = (queryable) => queryable ?? getPoolFn();

  async function getActor({ actorUserId, refreshTokenId, lock = false, queryable = null }) {
    if (!refreshTokenId) return null;
    const result = await db(queryable).query(`SELECT actor.id,actor.role,actor.is_disabled,actor.must_change_password,
      actor.user_preferences,token.is_revoked,token.expires_at,token.replaced_by_refresh_token_id
      FROM app_users actor JOIN refresh_tokens token ON token.app_user_id=actor.id
      WHERE actor.id=$1::uuid AND token.id=$2::uuid${lock ? ' FOR SHARE OF actor,token' : ''}`,
    [actorUserId, refreshTokenId]);
    const row = result.rows[0];
    return row ? { id: row.id, role: row.role, isDisabled: row.is_disabled, mustChangePassword: row.must_change_password,
      qualityPreferences: row.user_preferences, sessionRevoked: row.is_revoked,
      sessionExpiresAt: row.expires_at?.toISOString?.() ?? row.expires_at,
      sessionReplaced: row.replaced_by_refresh_token_id != null } : null;
  }

  async function getEpisode({ importCandidateId, operationRunId, queryable = null }) {
    const runResult = await db(queryable).query('SELECT id,operation_type,status,summary FROM operation_runs WHERE id=$1::uuid', [operationRunId]);
    const row = runResult.rows[0];
    const run = row ? { id: row.id, operationType: row.operation_type, status: row.status, summary: row.summary } : null;
    const candidate = await handoffStore.getCandidate(importCandidateId, db(queryable));
    const item = await handoffStore.getItem({ importCandidateId, operationRunId }, db(queryable));
    const origin = await db(queryable).query(`SELECT ${effectiveExecutionOriginSql({ importCandidateIdSql: '$1' })} AS id`, [importCandidateId]);
    return { candidate, run, item, currentOriginId: origin.rows[0]?.id ?? null };
  }

  async function lockEpisode({ importCandidateId, operationRunId, queryable }) {
    await handoffStore.lockEvidence({ importCandidateId, operationRunId }, queryable);
    return getEpisode({ importCandidateId, operationRunId, queryable });
  }

  return { getActor, getEpisode, lockEpisode,
    hasForeignBatchAttempt: (input, queryable = null) => handoffStore.hasForeignBatchAttempt(input, queryable),
    readParticipantPolicies: recoveryStore.readParticipantPolicies,
    lockParticipantReleases: recoveryStore.lockParticipantReleases,
    getDiscovery: recoveryStore.getDiscovery,
    findActiveSelection: recoveryStore.findActiveSelection };
}
