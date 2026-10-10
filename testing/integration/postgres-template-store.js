/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { drainPostgresFixtureBackends } from './postgres-backend-drain.js';

export function templateRefusal(code = 'fixture_template_invalid') {
  return Object.assign(new Error('The owned PostgreSQL fixture template is unavailable or invalid'), { code });
}

function identifier(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/u.test(value)) throw templateRefusal();
  return `"${value}"`;
}

export function templateDatabaseProfile(row) {
  return { serverVersion: row.server_version, encoding: row.encoding,
    localeProvider: row.locale_provider, collation: row.collation, ctype: row.ctype,
    locale: row.locale ?? null, icuRules: row.icu_rules ?? null };
}

export function createPostgresTemplateStore({ adminClient } = {}) {
  if (typeof adminClient?.query !== 'function') throw new TypeError('Template store requires a maintenance client');

  async function inspect(databaseName) {
    identifier(databaseName);
    const result = await adminClient.query(`SELECT d.oid::text AS oid, d.datallowconn AS connections_allowed,
      d.datistemplate AS broadly_cloneable,
      d.datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user) AS owned_by_current_role,
      current_setting('server_version_num') AS server_version,
      pg_encoding_to_char(d.encoding) AS encoding, d.datcollate AS collation, d.datctype AS ctype,
      to_jsonb(d)->>'datlocprovider' AS locale_provider,
      to_jsonb(d)->>'datlocale' AS locale, to_jsonb(d)->>'daticurules' AS icu_rules,
      (SELECT COUNT(*)::integer FROM pg_stat_activity WHERE datid=d.oid) AS active_count
      FROM pg_database d WHERE datname=$1`, [databaseName]);
    if (result.rows.length === 0) return null;
    if (result.rows.length !== 1) throw templateRefusal();
    const row = result.rows[0];
    if (!/^[1-9]\d{0,9}$/u.test(row.oid) || Number(row.oid) > 4_294_967_295
      || typeof row.connections_allowed !== 'boolean' || typeof row.broadly_cloneable !== 'boolean'
      || row.owned_by_current_role !== true || !Number.isSafeInteger(row.active_count) || row.active_count < 0) {
      throw templateRefusal();
    }
    return row;
  }

  async function assertOwned(databaseName, oid) {
    const row = await inspect(databaseName);
    if (!row || row.oid !== oid) throw templateRefusal('fixture_template_identity_changed');
    return row;
  }

  return {
    inspect,
    create: (databaseName) => adminClient.query(`CREATE DATABASE ${identifier(databaseName)} TEMPLATE template0 ALLOW_CONNECTIONS true`),
    async seal(databaseName, oid) {
      await assertOwned(databaseName, oid);
      await adminClient.query(`ALTER DATABASE ${identifier(databaseName)} ALLOW_CONNECTIONS false`);
      const row = await assertOwned(databaseName, oid);
      if (row.connections_allowed || row.broadly_cloneable || row.active_count !== 0) throw templateRefusal('fixture_template_not_quiescent');
      return row;
    },
    async assertSealed(databaseName, oid) {
      const row = await assertOwned(databaseName, oid);
      if (row.connections_allowed || row.broadly_cloneable || row.active_count !== 0) throw templateRefusal('fixture_template_not_quiescent');
      return row;
    },
    createClone: (databaseName, sourceName) => adminClient.query(`CREATE DATABASE ${identifier(databaseName)} TEMPLATE ${identifier(sourceName)} ALLOW_CONNECTIONS true`),
    async dropOwned(databaseName, oid) {
      const row = await inspect(databaseName);
      if (!row) return;
      if (row.oid !== oid) throw templateRefusal('fixture_template_identity_changed');
      await drainPostgresFixtureBackends({ adminClient, databaseName });
      await adminClient.query(`DROP DATABASE ${identifier(databaseName)}`);
      if (await inspect(databaseName)) throw templateRefusal('fixture_template_cleanup_incomplete');
    },
  };
}
