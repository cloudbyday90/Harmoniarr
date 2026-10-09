/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getPool } from '../database.js';
import { getImportCandidateById, listImportCandidateFiles, insertImportCandidateEvent } from './import-candidate-repository.js';
import { createImportCandidateReleaseRecheckStore } from './import-candidate-release-recheck-store.js';
import { MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE, MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE } from './music-queue-recovery-policy.js';

export function createMusicQueueRecoveryStore({ getPoolFn = getPool } = {}) {
  const scopeStore = createImportCandidateReleaseRecheckStore({ getPoolFn });
  const db = (queryable) => queryable ?? getPoolFn();
  async function getCandidate(id, queryable = null) {
    const candidate = await getImportCandidateById(id, db(queryable));
    return candidate ? { ...candidate, files: await listImportCandidateFiles(id, db(queryable)) } : null;
  }
  async function getOrigin(runId, candidateId, queryable = null) {
    if (!runId) return null;
    const result = await db(queryable).query(`SELECT runs.id, runs.operation_type, runs.status, runs.summary,runs.next_attempt_at,
      (SELECT planning_snapshot FROM import_execution_run_items WHERE operation_run_id=runs.id AND import_candidate_id=$2::uuid LIMIT 1) AS execution_snapshot,
      EXISTS(SELECT 1 FROM import_execution_run_items WHERE operation_run_id=runs.id AND import_candidate_id=$2::uuid)
        OR EXISTS(SELECT 1 FROM import_apply_run_items WHERE operation_run_id=runs.id AND import_candidate_id=$2::uuid) AS has_item
      FROM operation_runs runs WHERE runs.id=$1::uuid`, [runId, candidateId]);
    return result.rows[0] ?? null;
  }
  async function getDiscovery(metadataReleaseId, queryable = null) {
    const result = await db(queryable).query('SELECT * FROM library_discovery_requests WHERE metadata_release_id=$1::uuid', [metadataReleaseId]);
    const row = result.rows[0];
    return row ? { id: row.id, metadataReleaseId: row.metadata_release_id, searchMode: row.search_mode, requestStatus: row.request_status,
      lastSearchAt: row.last_search_at, nextSearchAfter: row.next_search_after, researchAttemptCount: row.research_attempt_count, evidence: row.evidence } : null;
  }
  async function listCandidateIds({ failedCandidateId, metadataReleaseId, sourceSearchId, maxAttempts }) {
    const result = await getPoolFn().query(`SELECT id FROM import_candidates WHERE id<>$1::uuid AND status IN ('pending','held')
      AND download_attempt_count<$4 AND normalized_payload #>> '{requestOwnership,externalRequestReleaseIntentId}' IS NULL
      AND (source_search_id=$2::text OR normalized_payload #>> '{discoveryScope,metadataReleaseId}'=$3::text
        OR normalized_payload #>> '{requestOwnership,metadataReleaseId}'=$3::text)
      ORDER BY (source_search_id=$2::text) DESC, CASE WHEN jsonb_typeof(normalized_payload->'compositeScore')='number'
        THEN (normalized_payload->>'compositeScore')::numeric END DESC NULLS LAST, file_count DESC, discovered_at, id LIMIT 25`,
    [failedCandidateId, sourceSearchId, metadataReleaseId, maxAttempts]);
    return result.rows.map((row) => row.id);
  }
  async function lockParents(ids, queryable) {
    await queryable.query('SELECT id FROM import_candidates WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [ids]);
    await queryable.query('SELECT id FROM import_candidate_files WHERE import_candidate_id=ANY($1::uuid[]) ORDER BY import_candidate_id,id FOR UPDATE', [ids]);
  }
  async function lockRecoveryCreation(queryable) {
    await queryable.query("SELECT pg_advisory_xact_lock(hashtextextended('harmoniarr.music-queue-recovery-create',0))");
  }
  async function isCurrentExecutionOrigin(candidateId, originRunId, queryable = null) {
    const result = await db(queryable).query(`SELECT runs.id FROM operation_runs runs WHERE operation_type='import_candidate_execution_planning'
      AND (runs.summary->>'selectedCandidateId'=$1::text OR EXISTS(SELECT 1 FROM import_execution_run_items WHERE operation_run_id=runs.id AND import_candidate_id=$1::uuid))
      ORDER BY runs.created_at DESC,runs.id DESC LIMIT 1`, [candidateId]);
    return result.rows[0]?.id === originRunId;
  }
  async function getEpisode(candidateId, originRunId, queryable) {
    const result = await queryable.query(`SELECT details->'recoveryEpisode' AS episode FROM import_candidate_events
      WHERE import_candidate_id=$1::uuid AND event_type='import_candidate_recovery_decided'
        AND details #>> '{recoveryEpisode,originRunId}' IS NOT DISTINCT FROM $2::text ORDER BY occurred_at DESC,id DESC LIMIT 1`, [candidateId, originRunId]);
    return result.rows[0]?.episode ?? null;
  }
  async function saveEpisode({ candidate, originRunId, result, observation }, queryable) {
    return insertImportCandidateEvent({ importCandidateId: candidate.id, eventType: 'import_candidate_recovery_decided',
      previousStatus: candidate.status, newStatus: candidate.status, details: { recoveryEpisode: { originRunId, result, observation } } }, queryable);
  }
  async function recordTerminal({ candidate, kind, reason, blockerCode, recoveryReasonCode }, queryable) {
    const eventType = kind === 'quality' ? 'import_candidate_quality_failed' : kind === 'import' ? 'import_candidate_import_blocked' : 'import_candidate_download_failed';
    const changed = candidate.status !== 'failed';
    if (changed) await queryable.query("UPDATE import_candidates SET status='failed',updated_at=NOW() WHERE id=$1::uuid", [candidate.id]);
    const event = await insertImportCandidateEvent({ importCandidateId: candidate.id, eventType, previousStatus: candidate.status,
      newStatus: 'failed', reason, details: { ...(blockerCode ? { addBlockerCode: blockerCode } : {}), ...(recoveryReasonCode ? { recoveryReasonCode } : {}) } }, queryable);
    return { event, candidate: await getCandidate(candidate.id, queryable) };
  }
  async function incrementAttempt(id, queryable) {
    await queryable.query('UPDATE import_candidates SET download_attempt_count=download_attempt_count+1,updated_at=NOW() WHERE id=$1::uuid', [id]);
    return getCandidate(id, queryable);
  }
  async function selectCandidate({ candidate, context, failedCandidateId, retry = false }, queryable) {
    await queryable.query(`UPDATE import_candidates SET status='selected',selection_reason='recovery_cascade',
      normalized_payload=jsonb_set(normalized_payload,'{musicQueue}',$2::jsonb) || jsonb_build_object('recoveryCascade',
        jsonb_build_object('triggeredByFailedCandidateId',$3::text,'promotedAt',NOW())),updated_at=NOW()
      WHERE id=$1::uuid AND status=ANY($4::text[])`, [candidate.id, JSON.stringify(context), failedCandidateId, retry ? ['failed'] : ['pending','held']]);
    return getCandidate(candidate.id, queryable);
  }
  async function findActiveSelection({ failedCandidateId, metadataReleaseId, queryable }) {
    const result = await db(queryable).query(`SELECT id FROM import_candidates WHERE id<>$1::uuid AND status IN ('selected','downloading','import_pending')
      AND (source_search_id IN(SELECT evidence->>'lastSearchId' FROM library_discovery_requests WHERE metadata_release_id=$2::uuid)
        OR normalized_payload #>> '{discoveryScope,metadataReleaseId}'=$2::text OR normalized_payload #>> '{requestOwnership,metadataReleaseId}'=$2::text) LIMIT 1`, [failedCandidateId, metadataReleaseId]);
    return result.rows[0] ?? null;
  }
  async function readExecutionReservation(candidateId, queryable = null) {
    const result = await db(queryable).query(`SELECT id,status,summary FROM operation_runs WHERE operation_type='import_candidate_execution_planning'
      AND summary->>'triggerSource'=$2 AND summary->>'selectedCandidateId'=$1::text ORDER BY created_at DESC,id DESC LIMIT 1`, [candidateId, MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE]);
    return result.rows[0] ?? null;
  }
  async function readDiscoveryReservation(metadataReleaseId, queryable = null) {
    const result = await db(queryable).query(`SELECT id,status,summary FROM operation_runs WHERE operation_type='library_discovery_dispatch'
      AND status IN ('pending','running') AND summary->>'triggerSource'=$2
      AND summary #>> '{musicQueueRecovery,superseded}' IS DISTINCT FROM 'true'
      AND summary #>> '{musicQueueRecovery,metadataReleaseId}'=$1::text ORDER BY created_at DESC,id DESC LIMIT 1`, [metadataReleaseId, MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE]);
    return result.rows[0] ?? null;
  }
  async function scheduleRediscovery({ discoveryId, nextSearchAfter, runId, failedCandidateId, sourceSearchId }, queryable) {
    await db(queryable).query(`UPDATE library_discovery_requests SET request_status='ready',blocked_reason=NULL,next_search_after=$2,
      search_attempt_count=1,research_attempt_count=research_attempt_count+1,updated_at=NOW(),
      evidence=evidence || jsonb_build_object('downloadRecoveryRediscovery',jsonb_build_object('owningRunId',$3::text,
        'triggeredByFailedCandidateId',$4::text,'nextSearchAfter',$2::timestamptz,'sourceSearchId',$5::text)) WHERE id=$1`,
    [discoveryId, nextSearchAfter, runId, failedCandidateId, sourceSearchId]);
  }
  async function holdRecoverySelection(candidateId, runId, queryable) {
    const result = await db(queryable).query("UPDATE import_candidates SET status='held',updated_at=NOW() WHERE id=$1::uuid AND status='selected' RETURNING id", [candidateId]);
    if (result.rowCount) await insertImportCandidateEvent({ importCandidateId: candidateId, eventType: 'import_candidate_held',
      previousStatus: 'selected', newStatus: 'held', details: { recoveryRunId: runId, recoveryAuthorityRefused: true } }, db(queryable));
    return result.rowCount > 0;
  }
  async function retireExecutionReservation(runId, queryable) {
    await db(queryable).query(`UPDATE operation_runs SET summary=summary || jsonb_build_object('musicQueueRecovery',
      CASE WHEN jsonb_typeof(summary->'musicQueueRecovery')='object' THEN summary->'musicQueueRecovery' ELSE '{}'::jsonb END || '{"retired":true}'::jsonb)
      WHERE id=$1::uuid AND summary->>'triggerSource'=$2`, [runId, MUSIC_QUEUE_RECOVERY_EXECUTION_SOURCE]);
  }
  async function recordExecutionNotDispatched({ runId, candidateId, knownDispatchStartedAt }, queryable) {
    const result = await db(queryable).query(`UPDATE import_execution_run_items SET item_status='blocked',
      planning_snapshot=jsonb_set(jsonb_set(planning_snapshot,'{execution,handoff,state}','"not_dispatched"'::jsonb),
        '{execution,outcome}','"authority_refused"'::jsonb),updated_at=NOW() WHERE operation_run_id=$1::uuid AND import_candidate_id=$2::uuid
        AND planning_snapshot #>> '{execution,handoff,dispatchStartedAt}'=$3::text
        AND planning_snapshot #>> '{execution,handoff,state}' IN ('dispatching','awaiting_confirmation')
        AND CASE WHEN jsonb_typeof(planning_snapshot #> '{execution,enqueuedTransfers}')='array'
          THEN jsonb_array_length(planning_snapshot #> '{execution,enqueuedTransfers}')=0
          ELSE planning_snapshot #> '{execution,enqueuedTransfers}' IS NULL END`, [runId, candidateId, knownDispatchStartedAt]);
    return result.rowCount > 0;
  }
  async function transitionExecutionPhase({ candidate, targetStatus, reason }, queryable) {
    const eventType = targetStatus === 'downloading' ? 'import_candidate_downloading' : 'import_candidate_import_pending';
    await db(queryable).query('UPDATE import_candidates SET status=$2,updated_at=NOW() WHERE id=$1::uuid', [candidate.id, targetStatus]);
    await insertImportCandidateEvent({ importCandidateId: candidate.id, eventType, previousStatus: candidate.status,
      newStatus: targetStatus, reason }, db(queryable));
    return getCandidate(candidate.id, queryable);
  }
  async function retireDiscoveryReservation({ runId, record, knownDispatchAttemptedAt = null }, queryable) {
    const result = await db(queryable).query(`UPDATE library_discovery_requests SET request_status='blocked',blocked_reason='recovery_scope_changed',
      next_search_after=NULL,updated_at=NOW(),evidence=jsonb_set(evidence,'{downloadRecoveryRediscovery,state}','"guard_refused"'::jsonb)
      WHERE metadata_release_id=$1::uuid AND evidence #>> '{downloadRecoveryRediscovery,owningRunId}'=$2::text
        AND evidence->>'lastSearchId'=$3::text AND request_status IN ('ready','cooldown')
        AND ((request_status='ready' AND next_search_after=$4::timestamptz)
          OR ($5::text IS NOT NULL AND evidence->>'lastDispatchRunId'=$2::text
            AND CASE WHEN pg_input_is_valid(evidence->>'lastDispatchAttemptedAt','timestamp with time zone')
              THEN (evidence->>'lastDispatchAttemptedAt')::timestamptz=$5::timestamptz ELSE false END))
      RETURNING id`, [record.metadataReleaseId, runId, record.failedSourceSearchId, record.nextSearchAfter, knownDispatchAttemptedAt]);
    return result.rowCount > 0;
  }
  async function supersedeDiscoveryReservations({ metadataReleaseId, queryable }) {
    await db(queryable).query(`UPDATE operation_runs SET summary=jsonb_set(summary,'{musicQueueRecovery,superseded}','true'::jsonb)
      WHERE operation_type='library_discovery_dispatch' AND status IN ('pending','running') AND summary->>'triggerSource'=$2
        AND summary #>> '{musicQueueRecovery,metadataReleaseId}'=$1::text`, [metadataReleaseId, MUSIC_QUEUE_RECOVERY_DISCOVERY_SOURCE]);
  }
  return { ...scopeStore, getCandidate, getOrigin, getDiscovery, listCandidateIds, lockParents, getEpisode, saveEpisode,
    recordTerminal, incrementAttempt, selectCandidate, findActiveSelection, readExecutionReservation, readDiscoveryReservation,
    supersedeDiscoveryReservations, isCurrentExecutionOrigin, scheduleRediscovery, holdRecoverySelection,
    retireExecutionReservation, recordExecutionNotDispatched, retireDiscoveryReservation, transitionExecutionPhase, lockRecoveryCreation };
}
