/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createControlledProviderMetadata } from './controlled-provider-metadata-fixture.mjs';

/** Inputs are controlled; wanted releases and discovery links are application-derived. */
export function createControlledProviderAuthorityFixtures({ pool, reconcileWantedReleases, reconcileDiscoveryRequests }) {
  assert.equal(typeof pool?.query, 'function');
  assert.equal(typeof reconcileWantedReleases, 'function');
  assert.equal(typeof reconcileDiscoveryRequests, 'function');

  async function createOperator({ minimumQuality = 'lossless', preferredFormat = 'flac' } = {}) {
    const result = await pool.query(`INSERT INTO app_users (username, password_hash, role, must_change_password, user_preferences)
      VALUES ($1, $2, 'admin', FALSE, $3::jsonb) RETURNING id`,
    [`controlled-provider-${randomUUID()}`, `fixture-hash-${randomUUID()}`, JSON.stringify({ minimumQuality, preferredFormat })]);
    return result.rows[0].id;
  }
  async function createDiscovery(fixture, { operatorIds, profiles, privateMarkers = false }) {
    assert.ok(operatorIds.length > 0 && new Set(operatorIds).size === operatorIds.length);
    assert.equal(operatorIds.length, profiles.length);
    const metadata = await createControlledProviderMetadata(pool, fixture);
    for (const [index, appUserId] of operatorIds.entries()) {
      await pool.query(`INSERT INTO operator_artist_monitoring (app_user_id, metadata_artist_id, is_monitored,
        monitored_release_group_types, release_scope, wanted_automation_mode, acquisition_profile_key,
        search_on_add_mode, selection_source_mode)
        VALUES ($1, $2, TRUE, ARRAY['album']::text[], 'current_and_future', 'current_and_future_matching', $3,
          'missing_now', 'policy_plus_overrides')`, [appUserId, metadata.metadataArtistId, profiles[index]]);
    }
    await reconcileWantedReleases();
    await reconcileDiscoveryRequests();
    const wanted = (await pool.query(`SELECT id AS "wantedReleaseId", app_user_id AS "appUserId"
      FROM library_wanted_releases WHERE metadata_release_id=$1 ORDER BY app_user_id`, [metadata.metadataReleaseId])).rows;
    assert.equal(wanted.length, operatorIds.length, 'canonical reconciliation must derive exactly the intended recipients');
    const byOperator = new Map(wanted.map(row => [row.appUserId, row.wantedReleaseId]));
    const wantedReleases = operatorIds.map(appUserId => ({ appUserId, wantedReleaseId: byOperator.get(appUserId) }));
    assert.ok(wantedReleases.every(row => row.wantedReleaseId), 'every operator needs a derived wanted release');
    const discovery = (await pool.query('SELECT id FROM library_discovery_requests WHERE metadata_release_id=$1', [metadata.metadataReleaseId])).rows;
    assert.equal(discovery.length, 1);
    const discoveryRequestId = discovery[0].id;
    const links = (await pool.query('SELECT wanted_release_id AS id FROM library_discovery_request_wanted_release_links WHERE discovery_request_id=$1', [discoveryRequestId])).rows;
    assert.deepEqual(links.map(row => row.id).sort(), wantedReleases.map(row => row.wantedReleaseId).sort());
    const privatePolicyMarkers = privateMarkers ? operatorIds.map((_, index) => `operator-${index + 1}-private-policy-${randomUUID()}`) : [];
    for (const [index, marker] of privatePolicyMarkers.entries()) {
      const wantedReleaseId = wantedReleases[index].wantedReleaseId;
      // Sentinels only. This object is deliberately not a quality-fallback consent.
      await pool.query(`UPDATE library_wanted_releases SET evidence=evidence || jsonb_build_object('privatePolicyMarker',$2::text)
        WHERE id=$1`, [wantedReleaseId, marker]);
      await pool.query(`UPDATE library_discovery_request_wanted_release_links SET evidence=evidence ||
        jsonb_build_object('musicQueueQualityOverride',jsonb_build_object('privatePolicyMarker',$3::text))
        WHERE discovery_request_id=$1 AND wanted_release_id=$2`, [discoveryRequestId, wantedReleaseId, marker]);
    }
    return { ...metadata, discoveryRequestId, appUserId: operatorIds[0], wantedReleaseId: wantedReleases[0].wantedReleaseId,
      wantedReleases, privatePolicyMarkers };
  }
  async function createSingleDiscovery(fixture, { appUserId, profile = 'lossless_archive' } = {}) {
    return createDiscovery(fixture, { operatorIds: [appUserId ?? await createOperator()], profiles: [profile] });
  }
  async function createSharedDiscovery(fixture, { strict = true } = {}) {
    const result = await createDiscovery(fixture, { operatorIds: [await createOperator(strict ? {} : { minimumQuality: 'high', preferredFormat: 'any' }),
      await createOperator({ minimumQuality: 'high', preferredFormat: 'any' })],
      profiles: ['lossless_archive', 'balanced_library'], privateMarkers: true });
    return { ...result, profileCode: strict ? 'lossless_archive' : 'high_quality' };
  }
  return { createOperator, createSingleDiscovery, createSharedDiscovery };
}
