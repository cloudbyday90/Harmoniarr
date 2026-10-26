/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
/** Acknowledge ownership queries for domain-focused fakes. Owner tests use real traces. */
export function withPreparationLockFixture(client) {
  const query = client.query;
  client.getTransactionStatus ??= () => 'I';
  client.query = async function (sql, ...args) {
    if (sql.includes('pg_catalog.pg_locks')) return { rows: [{ owned: false }] };
    if (sql.includes('pg_catalog.pg_try_advisory_lock')) return { rows: [{ acquired: true }] };
    if (sql.includes('pg_catalog.pg_advisory_unlock')) return { rows: [{ unlocked: true }] };
    return query.call(this, sql, ...args);
  };
  return client;
}
