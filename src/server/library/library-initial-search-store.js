/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function createLibraryInitialSearchStore() {
  async function recordInitialSearchIntent({ queryable, wantedReleaseId, requestedAt, requestedByUserId }) {
    const result = await queryable.query(`UPDATE library_discovery_request_wanted_release_links
      SET evidence = COALESCE(evidence, '{}'::jsonb) || jsonb_build_object('musicQueueInitialSearch',
        jsonb_build_object('wantedReleaseId', $1::text, 'requestedAt', $2::timestamptz, 'requestedByUserId', $3::text)),
        updated_at = NOW()
      WHERE wanted_release_id = $1::uuid AND NOT (evidence ? 'musicQueueInitialSearch')
      RETURNING wanted_release_id`, [wantedReleaseId, requestedAt, requestedByUserId]);
    return result.rowCount > 0;
  }
  return { recordInitialSearchIntent };
}
