/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from '../database.js';
import { RELEASE_RECHECK_FACTS_LATERAL_SQL, RELEASE_RECHECK_FACTS_SELECT_SQL, mapReleaseRecheckFacts } from './import-candidate-release-recheck-store.js';

// Keys and expressions are code-owned. Preserve missing versus explicit JSON null.
function projectObject(expression, keys, overrides = {}) {
  const fields = keys.map(key => `('${key}',${overrides[key] ?? `${expression}->'${key}'`})`).join(',');
  return `CASE WHEN jsonb_typeof(${expression})='object' THEN
    (SELECT COALESCE(jsonb_object_agg(field.key,field.value),'{}'::jsonb)
      FROM (VALUES ${fields}) AS field(key,value) WHERE field.value IS NOT NULL)
    ELSE ${expression} END`;
}
const contextKeys = ['wantedReleaseId','wantedReleaseIds','profileCode','minimumBitrateKbps','qualityOverride',
  'operatorTrackScopes','operatorTrackParticipants','sharedOperatorDiscovery'];
const context = expression => projectObject(expression, contextKeys, {
  qualityOverride: projectObject(`${expression}->'qualityOverride'`, ['mode','wantedReleaseId','minimumBitrateKbps']),
});
const payload = `(SELECT COALESCE(jsonb_object_agg(field.key,field.value),'{}'::jsonb) FROM (VALUES
  ('musicQueue',${context('saved_queue')}),('musicQueueContext',${context('saved_legacy')}),
  ('requestOwnership',${projectObject('saved_ownership', ['sourceMediaRequestId','sourceRequestedForUserId'])}))
  AS field(key,value) WHERE field.value IS NOT NULL)`;

export function createQualityReviewFailedCandidateStore({ getPoolFn = getPool } = {}) {
  async function readOwnedReview({ appUserId, wantedReleaseId, queryable = null }) {
    const row = (await (queryable ?? getPoolFn()).query(`SELECT lwr.id,lwr.app_user_id,lwr.metadata_release_id,owner.is_disabled,
      ${RELEASE_RECHECK_FACTS_SELECT_SQL} FROM library_wanted_releases lwr
      JOIN app_users owner ON owner.id=lwr.app_user_id
      LEFT JOIN library_discovery_requests ldr ON ldr.metadata_release_id=lwr.metadata_release_id
      ${RELEASE_RECHECK_FACTS_LATERAL_SQL} WHERE lwr.id=$1::uuid AND lwr.app_user_id=$2::uuid`, [wantedReleaseId, appUserId])).rows[0];
    return row ? { id: row.id, appUserId: row.app_user_id, metadataReleaseId: row.metadata_release_id,
      targetUser: { id: row.app_user_id, isDisabled: row.is_disabled }, libraryAddRecoveryFacts: mapReleaseRecheckFacts(row) } : null;
  }
  async function readFacts({ importCandidateId, queryable = null }) {
    const result = await (queryable ?? getPoolFn()).query(`WITH saved AS MATERIALIZED (
      SELECT id,status,source_search_id,normalized_payload->'musicQueue' AS saved_queue,
        normalized_payload->'musicQueueContext' AS saved_legacy,normalized_payload->'requestOwnership' AS saved_ownership
      FROM import_candidates WHERE id=$1::uuid)
      SELECT id,status,source_search_id,${payload} AS policy_payload FROM saved`, [importCandidateId]);
    const row = result.rows[0];
    return row ? { id: row.id, status: row.status, sourceSearchId: row.source_search_id, normalizedPayload: row.policy_payload } : null;
  }
  async function lockFailedCandidate({ importCandidateId, queryable }) {
    if (!queryable?.query) throw new TypeError('Failed-candidate locking requires an owning transaction');
    await queryable.query('SELECT id FROM import_candidates WHERE id=$1::uuid FOR UPDATE', [importCandidateId]);
  }
  return { readFacts, readOwnedReview, lockFailedCandidate };
}
