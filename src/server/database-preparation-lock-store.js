/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
// Reserved two-integer advisory namespace: HARM / PREP. Shared by all preparers.
export const databasePreparationLockKey = Object.freeze([0x4841524d, 0x50524550]);

export async function ownsDatabasePreparationLock(client) {
  const result = await client.query(`SELECT EXISTS (
    SELECT 1 FROM pg_catalog.pg_locks WHERE locktype='advisory' AND granted
      AND pid=pg_catalog.pg_backend_pid() AND classid=$1::oid AND objid=$2::oid AND objsubid=2
  ) AS owned`, databasePreparationLockKey);
  return result.rows[0]?.owned;
}

export async function tryDatabasePreparationLock(client) {
  const result = await client.query('SELECT pg_catalog.pg_try_advisory_lock($1::integer,$2::integer) AS acquired', databasePreparationLockKey);
  return result.rows[0]?.acquired;
}

export async function unlockDatabasePreparation(client) {
  const result = await client.query('SELECT pg_catalog.pg_advisory_unlock($1::integer,$2::integer) AS unlocked', databasePreparationLockKey);
  return result.rows[0]?.unlocked;
}
