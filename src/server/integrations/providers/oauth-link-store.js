/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { lockAppUserEligibility } from '../../app-user-eligibility-lock-store.js';
import { oauthSecretType, oauthCipherLimit } from './oauth-link-policy.js';

export async function lockOAuthActor(client, userId) {
  await lockAppUserEligibility({ userIds: [userId], mode: 'write', queryable: client });
  return (await client.query('SELECT role,is_disabled,must_change_password,password_changed_at::text AS credential_epoch FROM public.app_users WHERE id=$1', [userId])).rows[0] ?? null;
}
export async function lockOAuthLink(client, key) {
  await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [key]);
}
export async function lockOAuthConfiguration(client, provider) {
  await client.query("SELECT setting_key FROM public.app_settings WHERE namespace='providers' AND setting_key=$1 FOR SHARE", [provider + 'ClientId']);
  await client.query("SELECT id FROM public.encrypted_secrets WHERE secret_type='integration_credential' AND name=$1 FOR SHARE", [`providers.${provider}.clientSecret`]);
}
export async function readOAuthRecord(client, name) {
  const rows = (await client.query(`SELECT id,name,encryption_key_version,updated_at::text AS state_revision,clock_timestamp() AS observed_at,
    CASE WHEN octet_length(encrypted_value)<=$3 THEN encrypted_value END AS encrypted_value
    FROM public.encrypted_secrets WHERE secret_type=$1 AND name=$2 LIMIT 2`, [oauthSecretType, name, oauthCipherLimit])).rows;
  if (rows.length > 1 || (rows.length === 1 && !rows[0].encrypted_value)) throw new Error('OAuth secret record is ambiguous or exceeds its bound');
  return rows[0] ?? null;
}
export async function readOAuthExpiry(client) {
  return (await client.query("SELECT clock_timestamp()+interval '10 minutes' AS expires_at")).rows[0].expires_at.toISOString();
}
export async function assertOAuthNotExpired(client, expiresAt) {
  if ((await client.query('SELECT $1::timestamptz>clock_timestamp() AS unexpired', [expiresAt])).rows[0]?.unexpired !== true) throw new Error('OAuth state expired before publication');
}
export async function consumeOAuthState(client, proof, expiresAt) {
  const result = await client.query(`DELETE FROM public.encrypted_secrets WHERE id=$1 AND secret_type=$2 AND name=$3
    AND encrypted_value=$4::bytea AND updated_at IS NOT DISTINCT FROM $5::timestamptz AND $6::timestamptz>clock_timestamp()`,
  [proof.id, oauthSecretType, proof.name, proof.encryptedValue, proof.revision, expiresAt]);
  if (result.rowCount > 1) throw new Error('OAuth state consumption was not confirmed');
  return result.rowCount === 1;
}
export async function lockOAuthRecordProof(client, proof) {
  return (await client.query(`SELECT id FROM public.encrypted_secrets WHERE id=$1 AND secret_type=$2 AND name=$3
    AND encrypted_value=$4::bytea AND updated_at IS NOT DISTINCT FROM $5::timestamptz FOR UPDATE`,
  [proof.id, oauthSecretType, proof.name, proof.encryptedValue, proof.revision])).rowCount === 1;
}
export async function readOAuthStatus(client, name) {
  const row = (await client.query(`SELECT updated_at,CASE WHEN pg_column_size(metadata)<=16384 THEN metadata END AS metadata
    FROM public.encrypted_secrets WHERE secret_type=$1 AND name=$2 ORDER BY updated_at DESC,created_at DESC LIMIT 1`, [oauthSecretType, name])).rows[0];
  return { linked: Boolean(row), scope: row?.metadata?.scope ?? null, tokenType: row?.metadata?.tokenType ?? null,
    tokenExpiresAt: row?.metadata?.expiresAt ?? null, updatedAt: row?.updated_at?.toISOString?.() ?? row?.updated_at ?? null };
}
