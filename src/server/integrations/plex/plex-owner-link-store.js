/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { lockAppUserEligibility } from '../../app-user-eligibility-lock-store.js';
import { ownerLinkSecretType, ownerLinkTokenName, ownerLinkLockKey } from './plex-owner-link-policy.js';

export async function lockOwnerLink(client) {
  await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [ownerLinkLockKey]);
}

export async function lockOwnerLinkActor(client, userId) {
  await lockAppUserEligibility({ userIds: [userId], mode: 'write', queryable: client });
  const result = await client.query('SELECT id,role,is_disabled,must_change_password,password_changed_at::text AS credential_epoch FROM public.app_users WHERE id=$1', [userId]);
  return result.rows[0] ?? null;
}
export async function readOwnerLinkSecretRows(client, name) {
  const result = await client.query(`SELECT id,encryption_key_version,
    CASE WHEN octet_length(encrypted_value)<=16384 THEN encrypted_value END AS encrypted_value
    FROM public.encrypted_secrets WHERE secret_type=$1 AND name=$2 LIMIT 2`, [ownerLinkSecretType, name]);
  return result.rows;
}
export async function readOwnerLinkClock(client) {
  return (await client.query('SELECT clock_timestamp() AS observed_at')).rows[0].observed_at.toISOString();
}
export async function readOwnerLinkStatus(client) {
  const result = await client.query(`SELECT id,updated_at,
    CASE WHEN pg_column_size(metadata)<=16384 THEN metadata END AS metadata
    FROM public.encrypted_secrets WHERE secret_type=$1 AND name=$2 ORDER BY updated_at DESC,created_at DESC LIMIT 1`, [ownerLinkSecretType, ownerLinkTokenName]);
  const row = result.rows[0], meta = row?.metadata;
  return { linked: Boolean(row), linkedAt: meta?.linkedAt ?? null, linkedUserEmail: meta?.linkedUserEmail ?? null,
    linkedUserId: meta?.linkedUserId ?? null, linkedUserTitle: meta?.linkedUserTitle ?? null, linkedUsername: meta?.linkedUsername ?? null,
    linkedUserUuid: meta?.linkedUserUuid ?? null, thumbUrl: meta?.thumbUrl ?? null, updatedAt: row?.updated_at?.toISOString?.() ?? row?.updated_at ?? null };
}
