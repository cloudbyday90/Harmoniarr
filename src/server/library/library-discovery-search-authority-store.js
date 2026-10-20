/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { getPool } from '../database.js';
import { createOperationRunCancellationError } from '../operation-run-cancellation.js';
import { getSearchContinuationRecoveryMessage } from '../../shared/search-continuation-recovery.js';

export function createLibraryDiscoverySearchAuthorityStore({ getPoolFn = getPool } = {}) {
  async function assertClaimCurrent({ claimedRequest, queryable = null }) {
    const result = await (queryable ?? getPoolFn()).query(`SELECT id FROM library_discovery_requests
      WHERE id=$1 AND metadata_release_id=$2 AND search_mode='automatic'
        AND request_status IN ('cooldown','ready') AND evidence->>'lastDispatchAttemptedAt'=$3
      ${queryable ? 'FOR UPDATE' : ''}`, [claimedRequest.discoveryRequestId, claimedRequest.metadataReleaseId,
      claimedRequest.evidence?.lastDispatchAttemptedAt ?? null]);
    if (!result.rows[0]) throw createOperationRunCancellationError({ message: 'The discovery search claim is no longer current' });
  }
  async function deferContinuation({ claimedRequest, nextSearchAfter, queryable = null, searchId = null }) {
    await (queryable ?? getPoolFn()).query(`UPDATE library_discovery_requests SET next_search_after=$2,
      evidence=COALESCE(evidence,'{}'::jsonb)||jsonb_build_object('searchContinuation',jsonb_build_object(
        'state','pending','nextSearchAfter',$2::timestamptz,'claimMarker',$3::text,'searchAttemptCount',search_attempt_count)),updated_at=NOW()
      WHERE id=$1 AND request_status='cooldown' AND evidence->>'lastDispatchAttemptedAt'=$3
        AND ($4::text IS NULL OR evidence->>'lastSearchId' IS DISTINCT FROM $4::text)`,
    [claimedRequest.discoveryRequestId, nextSearchAfter, claimedRequest.evidence?.lastDispatchAttemptedAt ?? null, searchId]);
  }
  async function stopContinuation({ claimedRequest, errorCode }) {
    const message = getSearchContinuationRecoveryMessage(errorCode);
    if (!message) throw new TypeError('Unknown terminal search continuation failure');
    const result = await getPoolFn().query(`UPDATE library_discovery_requests
      SET request_status='blocked',blocked_reason=$4,next_search_after=NULL,
        evidence=(COALESCE(evidence,'{}'::jsonb)-'searchContinuation') || jsonb_build_object(
          'lastDispatchFailure',jsonb_build_object('code',$4::text,'message',$5::text)),updated_at=NOW()
      WHERE id=$1 AND metadata_release_id=$2 AND search_mode='automatic'
        AND request_status IN ('cooldown','ready') AND evidence->>'lastDispatchAttemptedAt'=$3`,
    [claimedRequest.discoveryRequestId, claimedRequest.metadataReleaseId,
      claimedRequest.evidence?.lastDispatchAttemptedAt ?? null, errorCode, message]);
    return result.rowCount === 1;
  }
  return { assertClaimCurrent, deferContinuation, stopContinuation };
}
