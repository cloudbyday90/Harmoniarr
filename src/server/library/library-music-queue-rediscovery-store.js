/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function createLibraryMusicQueueRediscoveryStore() {
  async function lockOwnedWantedRelease({ appUserId, metadataReleaseId, queryable, wantedReleaseId }) {
    const wanted = await queryable.query(`SELECT id FROM library_wanted_releases
      WHERE id = $1 AND app_user_id = $2 AND metadata_release_id = $3
        AND wanted_status IN ('missing', 'partial') FOR NO KEY UPDATE`,
    [wantedReleaseId, appUserId, metadataReleaseId]);
    if (!wanted.rowCount) return false;

    const discovery = await queryable.query(`SELECT discovery.id
      FROM library_discovery_requests discovery
      JOIN library_discovery_request_wanted_release_links links ON links.discovery_request_id = discovery.id
      WHERE discovery.metadata_release_id = $1 AND links.wanted_release_id = $2
      FOR UPDATE OF discovery, links`, [metadataReleaseId, wantedReleaseId]);
    return discovery.rowCount > 0;
  }

  async function recordCoalescedTargetIntent({ queryable, reasonCode, requestedAt, requestedByUserId, wantedReleaseId }) {
    const result = await queryable.query(`UPDATE library_discovery_request_wanted_release_links
      SET evidence = COALESCE(evidence, '{}'::jsonb) || jsonb_build_object('musicQueueRediscovery',
        jsonb_build_object('reasonCode', $2::text, 'requestedAt', $3::text,
          'requestedByUserId', $4::text, 'wantedReleaseId', $1::text)), updated_at = NOW()
      WHERE wanted_release_id = $1 AND evidence #>> '{musicQueueRediscovery,requestedAt}' IS DISTINCT FROM $3::text
      RETURNING wanted_release_id`, [wantedReleaseId, reasonCode, requestedAt, requestedByUserId]);
    return result.rowCount > 0;
  }

  return { lockOwnedWantedRelease, recordCoalescedTargetIntent };
}
