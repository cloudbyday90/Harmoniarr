/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { plexCallbackSecretType, plexCallbackMaxCiphertextBytes } from './plex-callback-policy.js';

export async function readPlexSecretRecord(client, name) {
  const result = await client.query(`SELECT id,encrypted_value,encryption_key_version,updated_at::text AS state_revision,
    clock_timestamp() AS observed_at FROM public.encrypted_secrets WHERE secret_type=$1 AND name=$2
    AND octet_length(encrypted_value)<=$3 ORDER BY updated_at DESC,created_at DESC LIMIT 1`,
  [plexCallbackSecretType, name, plexCallbackMaxCiphertextBytes]);
  return result.rows[0] ?? null;
}
export async function getPlexCallbackExpiry(client) {
  const result = await client.query("SELECT clock_timestamp()+interval '10 minutes' AS expires_at");
  return result.rows[0].expires_at.toISOString();
}
export async function consumePlexCallbackState(client, proof) {
  const result = await client.query(`DELETE FROM public.encrypted_secrets WHERE id=$1 AND secret_type=$2 AND name=$3
    AND encrypted_value=$4::bytea AND updated_at IS NOT DISTINCT FROM $5::timestamptz
    AND $6::timestamptz>clock_timestamp()`,
  [proof.id, plexCallbackSecretType, proof.name, proof.encryptedValue, proof.revision, proof.expiresAt]);
  if (result.rowCount === 0) return false;
  if (result.rowCount !== 1) throw new Error('Callback state consumption was not confirmed');
  return true;
}
export async function assertPlexCallbackNotExpired(client, proof) {
  const result = await client.query('SELECT $1::timestamptz>clock_timestamp() AS unexpired', [proof.expiresAt]);
  if (result.rows[0]?.unexpired !== true) throw new Error('Callback expired before publication');
}
