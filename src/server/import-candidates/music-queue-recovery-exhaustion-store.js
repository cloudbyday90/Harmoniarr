/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import { createApiError } from '../auth.js';

/** Caller owns current recipient/run checks and the recovery/discovery transaction locks. */
export async function persistMusicQueueRecoveryExhaustion({ discoveryId, sourceSearchId, failedCandidateId,
  maxResearchAttempts, observedAt }, queryable) {
  const result = await queryable.query(`UPDATE library_discovery_requests SET request_status='blocked',
    blocked_reason='download_recovery_exhausted',next_search_after=NULL,updated_at=NOW(),
    evidence=COALESCE(evidence,'{}'::jsonb) || jsonb_build_object('downloadRecoveryExhausted',jsonb_build_object(
      'researchAttemptCount',research_attempt_count,'maxResearchAttemptCount',$4::integer,
      'triggeredByFailedCandidateId',$3::text,'sourceSearchId',$2::text,'observedAt',$5::timestamptz))
    WHERE id=$1::uuid AND search_mode='automatic' AND evidence->>'lastSearchId'=$2::text
      AND research_attempt_count >= $4::integer RETURNING research_attempt_count`,
  [discoveryId, sourceSearchId, failedCandidateId, maxResearchAttempts, observedAt]);
  if (result.rowCount !== 1) throw createApiError(409, 'music_queue_recovery_not_current', 'The exhausted recovery search changed');
  return { scheduled: false, exhausted: true, reason: 'rediscovery_exhausted',
    researchAttemptCount: result.rows[0].research_attempt_count, maxResearchAttemptCount: maxResearchAttempts };
}
