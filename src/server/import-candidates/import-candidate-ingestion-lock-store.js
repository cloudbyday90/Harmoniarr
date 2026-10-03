/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

/** Match the parent-first ID order used by prepared multi-candidate apply acceptance. */
export async function lockExistingImportCandidateIngestionParents({ candidates, queryable }) {
  if (!candidates.length) return;
  const identities = candidates.map(({ sourceProvider, sourceSearchId, sourceResponseKey }) => ({ sourceProvider, sourceSearchId, sourceResponseKey }));
  await queryable.query(`SELECT candidate.id FROM import_candidates candidate
    JOIN jsonb_to_recordset($1::jsonb) incoming("sourceProvider" text,"sourceSearchId" text,"sourceResponseKey" text)
      ON candidate.source_provider = incoming."sourceProvider" AND candidate.source_search_id = incoming."sourceSearchId"
      AND candidate.source_response_key = incoming."sourceResponseKey"
    ORDER BY candidate.id FOR UPDATE OF candidate`, [JSON.stringify(identities)]);
}
