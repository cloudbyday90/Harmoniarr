/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { plexCallbackSecretType, plexCallbackMaxCiphertextBytes } from './plex-callback-policy.js';
import { plexCallbackRetentionLockKey, plexCallbackRetentionNamePattern } from './plex-callback-retention-policy.js';

export async function claimPlexCallbackRetention(client) {
  const result = await client.query('SELECT pg_try_advisory_xact_lock($1::bigint) AS acquired,clock_timestamp() AS observed_at', [plexCallbackRetentionLockKey]);
  return result.rows[0];
}
export async function lockPlexCallbackRetentionBatch(client, { cursor, batchSize }) {
  const result = await client.query(`SELECT id,name,created_at,updated_at,
    CASE WHEN octet_length(encrypted_value)<=$3 THEN encrypted_value END AS encrypted_value,encryption_key_version
    FROM public.encrypted_secrets WHERE secret_type=$1 AND name ~ $2
    AND ($4::text IS NULL OR (name,id)>($4::text,$5::uuid))
    ORDER BY name,id LIMIT $6 FOR UPDATE SKIP LOCKED`,
  [plexCallbackSecretType, plexCallbackRetentionNamePattern, plexCallbackMaxCiphertextBytes, cursor?.name ?? null, cursor?.id ?? null, batchSize]);
  return result.rows;
}
export async function deletePlexCallbackRetentionBatch(client, selected) {
  if (!selected.length) return;
  const result = await client.query(`DELETE FROM public.encrypted_secrets AS secret
    USING unnest($1::uuid[],$2::timestamptz[]) AS selected(id,delete_after)
    WHERE secret.id=selected.id AND secret.secret_type=$3 AND secret.name ~ $4 AND selected.delete_after<=clock_timestamp()`,
  [selected.map(row => row.id), selected.map(row => row.deleteAfter), plexCallbackSecretType, plexCallbackRetentionNamePattern]);
  if (result.rowCount !== selected.length) throw new Error('Callback retention deletion was not confirmed');
}
