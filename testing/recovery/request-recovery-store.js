/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export async function createRequestRecoveryUsers({ queryable }) {
  const result = await queryable.query(`
    INSERT INTO app_users (username, password_hash, role)
    VALUES ('recovery-fixture-admin', '!recovery-fixture-no-login', 'admin'),
      ('recovery-fixture-recipient-one', '!recovery-fixture-no-login', 'requester'),
      ('recovery-fixture-recipient-two', '!recovery-fixture-no-login', 'requester')
    RETURNING id, role, username
  `);
  return {
    adminUserId: result.rows.find((row) => row.role === 'admin').id,
    recipientUserIds: result.rows.filter((row) => row.role === 'requester')
      .sort((left, right) => left.username.localeCompare(right.username)).map((row) => row.id),
  };
}

export async function addRequestRecoveryEvent({ queryable, mediaRequestId, actorUserId }) {
  await queryable.query(`
    INSERT INTO media_request_events (media_request_id, event_type, actor_user_id, details)
    VALUES ($1, 'created', $2, '{"fixture":"backup_restore_continuity"}'::jsonb)
  `, [mediaRequestId, actorUserId]);
}

// All comparisons stay in process memory. Snapshots are deliberately not an
// evidence-report format: they contain exact synthetic source and ledger data.
export async function readRequestRecoverySnapshot({ queryable, fixture }) {
  const requestIds = [fixture.reviewedRequestId, fixture.pendingRequestId];
  const requestRelations = {
    requests: 'SELECT * FROM media_requests WHERE id = ANY($1::uuid[]) ORDER BY id',
    requestEvents: 'SELECT * FROM media_request_events WHERE media_request_id = ANY($1::uuid[]) ORDER BY id',
    collections: 'SELECT * FROM library_external_request_collections WHERE media_request_id = ANY($1::uuid[]) ORDER BY media_request_id',
    items: 'SELECT * FROM library_external_request_collection_items WHERE media_request_id = ANY($1::uuid[]) ORDER BY id',
    intents: 'SELECT * FROM library_external_request_release_intents WHERE media_request_id = ANY($1::uuid[]) ORDER BY id',
    work: 'SELECT * FROM provider_ingest_requests WHERE media_request_id = ANY($1::uuid[]) ORDER BY id',
    runs: "SELECT * FROM operation_runs WHERE summary->>'mediaRequestId' = ANY($1::text[]) ORDER BY id",
    audits: "SELECT * FROM audit_events WHERE entity_type = 'media_request' AND entity_id = ANY($1::uuid[]) ORDER BY id",
    candidates: "SELECT * FROM import_candidates WHERE normalized_payload->'requestOwnership'->>'sourceMediaRequestId' = ANY($1::text[]) ORDER BY id",
  };
  const snapshot = { schemaVersion: 1 };
  for (const [key, sql] of Object.entries(requestRelations)) {
    snapshot[key] = (await queryable.query(sql, [requestIds])).rows;
  }
  snapshot.users = (await queryable.query('SELECT * FROM app_users WHERE id = ANY($1::uuid[]) ORDER BY id', [
    [fixture.adminUserId, ...fixture.recipientUserIds],
  ])).rows;
  const metadataRelations = {
    artists: ['metadata_artists', fixture.metadataArtistId],
    releaseGroups: ['metadata_release_groups', fixture.metadataReleaseGroupId],
    releases: ['metadata_releases', fixture.metadataReleaseId],
    media: ['metadata_media', fixture.metadataMediumId],
    recordings: ['metadata_recordings', fixture.metadataRecordingId],
    tracks: ['metadata_tracks', fixture.metadataTrackId],
  };
  snapshot.metadata = {};
  for (const [key, [table, id]] of Object.entries(metadataRelations)) {
    snapshot.metadata[key] = (await queryable.query(`SELECT * FROM ${table} WHERE id = $1`, [id])).rows;
  }
  return JSON.parse(JSON.stringify(snapshot));
}

async function rejectsWithCode(queryable, sql, values, codes, constraint) {
  try {
    await queryable.query(sql, values);
  } catch (error) {
    if (codes.includes(error?.code) && error.constraint === constraint) return;
    throw new Error('Restored request constraints could not be verified', { cause: error });
  }
  throw new Error('A restored request constraint did not reject conflicting data');
}

export async function verifyRequestRecoveryConstraints({ queryable, fixture }) {
  await rejectsWithCode(queryable, `
    INSERT INTO provider_ingest_requests (media_request_id, source_provider, source_resource_type,
      ingest_target_type, source_identifier, canonical_url, page_number, page_cursor, ingest_key, status, evidence)
    SELECT media_request_id, source_provider, source_resource_type, ingest_target_type, source_identifier,
      canonical_url, page_number, page_cursor, ingest_key, status, evidence
    FROM provider_ingest_requests WHERE media_request_id = $1 ORDER BY id LIMIT 1
  `, [fixture.pendingRequestId], ['23505'], 'provider_ingest_requests_identity_unique');
  await rejectsWithCode(queryable, `
    INSERT INTO library_external_request_collection_items
      (media_request_id, item_key, source_provider, source_identifier, item_kind)
    SELECT media_request_id, item_key, source_provider, source_identifier, item_kind
    FROM library_external_request_collection_items WHERE media_request_id = $1 ORDER BY id LIMIT 1
  `, [fixture.pendingRequestId], ['23505'], 'external_collection_item_identity_unique');
  await rejectsWithCode(queryable, `
    INSERT INTO library_external_request_release_intents
      (media_request_id, metadata_release_id, requested_for_user_id, provider_key, provider_evidence)
    SELECT media_request_id, metadata_release_id, requested_for_user_id, provider_key || ':duplicate-fixture', provider_evidence
    FROM library_external_request_release_intents WHERE id = $1
  `, [fixture.reviewedIntentId], ['23505'], 'external_request_release_intents_release_unique');
  await rejectsWithCode(queryable, `
    INSERT INTO library_external_request_release_intents
      (media_request_id, metadata_release_id, requested_for_user_id, provider_key, provider_evidence)
    SELECT media_request_id, harmoniarr_generate_uuid(), requested_for_user_id, provider_key, provider_evidence
    FROM library_external_request_release_intents WHERE id = $1
  `, [fixture.reviewedIntentId], ['23505'], 'external_request_release_intents_provider_unique');
  await rejectsWithCode(queryable, 'DELETE FROM operation_runs WHERE id = $1', [fixture.discoveryRunId], ['23001', '23503'],
    'library_external_request_release_intents_operation_run_id_fkey');
}
