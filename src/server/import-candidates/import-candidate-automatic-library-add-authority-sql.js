/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { AUTOMATIC_LIBRARY_ADD_REQUEST_OWNERSHIP_FIELDS } from './import-candidate-music-queue-auto-safe-add-policy.js';

const context = "COALESCE(candidate.normalized_payload->'musicQueue', candidate.normalized_payload->'musicQueueContext')";
const ownershipFields = AUTOMATIC_LIBRARY_ADD_REQUEST_OWNERSHIP_FIELDS.map((field) => `'${field}'`).join(',');
const uuid = '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

function acquiredIds(scope) {
  return `(SELECT jsonb_agg(acquired.wanted_id ORDER BY acquired.wanted_id) FROM (
    SELECT ${scope}->>'wantedReleaseId' AS wanted_id
    UNION SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(${scope}->'wantedReleaseIds')='array'
      THEN ${scope}->'wantedReleaseIds' ELSE '[]'::jsonb END)
  ) acquired WHERE acquired.wanted_id IS NOT NULL)`;
}

const rawIdentityValid = `${context}->>'wantedReleaseId' ~* '${uuid}'
  AND NOT EXISTS (SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(candidate.normalized_payload)='object'
    THEN candidate.normalized_payload ELSE '{}'::jsonb END) saved_context
    WHERE saved_context.key IN ('musicQueue','musicQueueContext') AND (
      jsonb_typeof(saved_context.value)<>'object'
      OR (saved_context.value ? 'wantedReleaseId' AND (jsonb_typeof(saved_context.value->'wantedReleaseId')<>'string'
        OR NOT COALESCE(saved_context.value->>'wantedReleaseId' ~* '${uuid}',FALSE)))
      OR (saved_context.value ? 'wantedReleaseIds' AND (jsonb_typeof(saved_context.value->'wantedReleaseIds')<>'array'
        OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(saved_context.value->'wantedReleaseIds')='array'
          THEN saved_context.value->'wantedReleaseIds' ELSE '[]'::jsonb END) member
          WHERE jsonb_typeof(member)<>'string' OR NOT COALESCE(member #>> '{}' ~* '${uuid}',FALSE))))))
  AND (NOT (candidate.normalized_payload ? 'musicQueue' AND candidate.normalized_payload ? 'musicQueueContext')
    OR (candidate.normalized_payload #>> '{musicQueue,wantedReleaseId}' = candidate.normalized_payload #>> '{musicQueueContext,wantedReleaseId}'
      AND ${acquiredIds("(candidate.normalized_payload->'musicQueue')")} = ${acquiredIds("(candidate.normalized_payload->'musicQueueContext')")}))
  AND (NOT candidate.normalized_payload ? 'requestOwnership' OR jsonb_typeof(candidate.normalized_payload->'requestOwnership') IN ('object','null'))
  AND NOT EXISTS (SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(candidate.normalized_payload->'requestOwnership')='object'
    THEN candidate.normalized_payload->'requestOwnership' ELSE '{}'::jsonb END) owned_field WHERE owned_field.key IN (${ownershipFields})
    AND (jsonb_typeof(owned_field.value) NOT IN ('string','null') OR length(owned_field.value #>> '{}')>200))`;

/** Same bounded identity as buildAutomaticLibraryAddAuthority, for truthful read/write coalescing facts. */
export const AUTOMATIC_LIBRARY_ADD_AUTHORITY_MATCH_SQL = `active.summary->'automaticLibraryAddAuthority' = CASE WHEN ${rawIdentityValid} THEN jsonb_build_object(
  'wantedReleaseId', ${context}->>'wantedReleaseId',
  'wantedReleaseIds', ${acquiredIds(context)},
  'requestOwnership', jsonb_build_object('present', candidate.normalized_payload ? 'requestOwnership') ||
    CASE WHEN candidate.normalized_payload ? 'requestOwnership' THEN jsonb_build_object('value',
      CASE WHEN jsonb_typeof(candidate.normalized_payload->'requestOwnership')='object' THEN
        (SELECT COALESCE(jsonb_object_agg(identity.key,identity.value),'{}'::jsonb)
         FROM jsonb_each(candidate.normalized_payload->'requestOwnership') identity WHERE identity.key IN (${ownershipFields}))
      ELSE 'null'::jsonb END) ELSE '{}'::jsonb END) ELSE NULL END`;
