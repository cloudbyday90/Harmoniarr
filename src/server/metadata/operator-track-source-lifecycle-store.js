/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

export function createOperatorTrackSourceLifecycleStore() {
  async function transitionSource({ source, queryable }) {
    const next = source.available ? 'already_exists' : 'needs_fetch';
    const marker = { version: 1, state: source.available ? 'retired' : 'reopened', importCandidateId: source.importCandidateId, scope: source.scope };
    const result = await queryable.query(`UPDATE media_requests SET request_state=$4,evidence=COALESCE(evidence,'{}'::jsonb)
      || jsonb_build_object('operatorTrackSourceLifecycle',$5::jsonb),updated_at=NOW()
      WHERE id=$1::uuid AND requested_for_user_id=$2::uuid AND matched_metadata_release_id=$3::uuid
        AND evidence #> '{operatorArtistReconciliation,operatorTrackScope}'=$6::jsonb
        AND request_state NOT IN ('cancelled','failed')
        AND EXISTS(SELECT 1 FROM app_users WHERE id=$2::uuid AND is_disabled=FALSE)
        AND (($7::boolean AND request_state='needs_fetch') OR (NOT $7::boolean AND request_state='already_exists'
          AND evidence #>> '{operatorTrackSourceLifecycle,version}'='1'
          AND evidence #>> '{operatorTrackSourceLifecycle,state}'='retired'
          AND evidence #> '{operatorTrackSourceLifecycle,scope}'=$6::jsonb)) RETURNING id`,
    [source.mediaRequestId, source.ownerId, source.scope.metadataReleaseId, next, JSON.stringify(marker), JSON.stringify(source.scope), source.available]);
    return result.rowCount === 1;
  }
  async function insertEvent({ source, queryable }) {
    await queryable.query(`INSERT INTO media_request_events(media_request_id,event_type,details,occurred_at)
      VALUES($1::uuid,$2,$3::jsonb,NOW())`, [source.mediaRequestId,
      source.available ? 'operator_track_source_retired' : 'operator_track_source_reopened',
      JSON.stringify({ importCandidateId: source.importCandidateId, ownerId: source.ownerId, metadataReleaseId: source.scope.metadataReleaseId })]);
  }
  return { transitionSource, insertEvent };
}
