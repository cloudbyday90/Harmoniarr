/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { runPackagedCandidateNotificationProbe } from './docker-candidate-notification-probe.js';

// This function is serialized into `node --input-type=module --eval` inside the
// image. Keep its imports and dependencies local: host source is never loaded
// as the packaged migration manifest or used to connect to PostgreSQL.
export async function runPackagedCandidateSchemaProbe({ fixture, seed, indexNames }, notificationProbe = runPackagedCandidateNotificationProbe) {
  let client;
  try {
    const { default: pg } = await import('pg');
    const { loadMigrationManifest } = await import('/app/server-dist/migration-manifest.js');
    const port = Number(process.env.POSTGRES_PORT ?? '5432');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
    client = new pg.Client({ host: '127.0.0.1', port,
      user: process.env.POSTGRES_USER ?? 'harmoniarr', database: process.env.POSTGRES_DB ?? 'harmoniarr',
      password: process.env.POSTGRES_PASSWORD, connectionTimeoutMillis: 5000, query_timeout: 15000,
      statement_timeout: 12000 });
    await client.connect();
    const manifest = (await loadMigrationManifest()).map(({ filename, checksum, migrationKey }) => ({ filename, checksum, migrationKey }));
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    const ledger = (await client.query(`SELECT id, filename, checksum, migration_key AS "migrationKey", status
      FROM schema_migrations ORDER BY filename`)).rows;
    const targetColumn = fixture && (await client.query(`SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'media_requests' AND column_name = 'requested_for_user_id'`)).rowCount > 0;
    if (seed) {
      await client.query(`INSERT INTO app_users (id, username, password_hash, role, is_disabled)
        VALUES ($1, $2, '!packaged-continuity-disabled!', 'requester', TRUE)`, [fixture.userId, fixture.username]);
      await client.query(`INSERT INTO media_requests (id, requested_by_user_id,
        ${targetColumn ? 'requested_for_user_id,' : ''} request_kind, request_state, artist_name, release_title, normalized_query, notes, evidence)
        VALUES ($1, $2, ${targetColumn ? '$2,' : ''} 'release', 'needs_review', 'Candidate continuity artist',
        'Candidate continuity release', $3, 'Generated packaged upgrade continuity fixture', $4::jsonb)`,
      [fixture.requestId, fixture.userId, `candidate-continuity-${fixture.requestId}`, JSON.stringify({ fixture: 'docker-candidate-continuity', version: 1 })]);
    }
    const user = fixture ? (await client.query(`SELECT id, username, password_hash, role, is_disabled, created_at, updated_at
      FROM app_users WHERE id = $1`, [fixture.userId])).rows[0] ?? null : null;
    const request = fixture ? (await client.query(`SELECT id, requested_by_user_id,
      ${targetColumn ? 'requested_for_user_id,' : ''} request_kind, request_state, artist_name, release_title,
      normalized_query, notes, evidence, created_at, updated_at FROM media_requests WHERE id = $1`, [fixture.requestId])).rows[0] ?? null : null;
    const { notificationContinuity, notificationSchema } = await notificationProbe({ client, fixture, seed });
    const indexes = (await client.query(`SELECT index_class.relname AS name, table_class.relname AS "tableName",
      index_state.indisvalid AS valid, index_state.indisready AS ready, pg_get_indexdef(index_class.oid) AS definition
      FROM pg_index index_state JOIN pg_class index_class ON index_class.oid = index_state.indexrelid
      JOIN pg_class table_class ON table_class.oid = index_state.indrelid
      JOIN pg_namespace namespace ON namespace.oid = table_class.relnamespace
      WHERE namespace.nspname = 'public' AND index_class.relname = ANY($1::text[]) ORDER BY index_class.relname`, [indexNames])).rows;
    const identity = (await client.query(`SELECT current_database() AS database, current_user AS username,
      current_setting('server_version_num') AS "postgresVersion"`)).rows[0];
    await client.query('COMMIT');
    process.stdout.write(JSON.stringify({ manifest, ledger, user, request, indexes, identity,
      notificationContinuity, notificationSchema, nodeVersion: process.version }));
  } catch {
    process.stderr.write('Packaged candidate schema probe failed\n');
    process.exitCode = 1;
  } finally {
    await client?.end().catch(() => {});
  }
}

export function createPackagedCandidateSchemaProbeSource() {
  return `const runPackagedCandidateNotificationProbe = (${runPackagedCandidateNotificationProbe.toString()});
    await (${runPackagedCandidateSchemaProbe.toString()})(JSON.parse(process.argv[1]), runPackagedCandidateNotificationProbe);`;
}
