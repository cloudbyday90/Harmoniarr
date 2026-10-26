/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

const queries = {
  tables: `SELECT a.key, CASE WHEN c.oid IS NOT NULL THEN pg_catalog.jsonb_build_object(
    'kind', c.relkind, 'persistence', c.relpersistence, 'rowSecurity', c.relrowsecurity,
    'forceRowSecurity', c.relforcerowsecurity) END AS actual
    FROM pg_catalog.jsonb_to_recordset($1::jsonb) AS a(key text, name text)
    LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
    LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=a.name`,
  columns: `SELECT a.key, CASE WHEN col.attnum IS NOT NULL THEN pg_catalog.jsonb_build_object(
    'type', pg_catalog.format_type(col.atttypid,col.atttypmod), 'notNull', col.attnotnull,
    'default', pg_catalog.pg_get_expr(d.adbin,d.adrelid,false), 'identity', col.attidentity,
    'generated', col.attgenerated, 'collation', cn.nspname || '.' || co.collname) END AS actual
    FROM pg_catalog.jsonb_to_recordset($1::jsonb) AS a(key text, name text, parent text)
    LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
    LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=a.parent
    LEFT JOIN pg_catalog.pg_attribute col ON col.attrelid=c.oid AND col.attname=a.name AND col.attnum>0 AND NOT col.attisdropped
    LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=col.attnum
    LEFT JOIN pg_catalog.pg_collation co ON co.oid=col.attcollation
    LEFT JOIN pg_catalog.pg_namespace cn ON cn.oid=co.collnamespace`,
  constraints: `SELECT a.key, CASE WHEN con.oid IS NOT NULL THEN pg_catalog.jsonb_build_object(
    'type', con.contype, 'definition', pg_catalog.pg_get_constraintdef(con.oid,false),
    'validated', con.convalidated, 'enforced', con.conenforced, 'deferrable', con.condeferrable,
    'deferred', con.condeferred, 'noInherit', con.connoinherit) END AS actual
    FROM pg_catalog.jsonb_to_recordset($1::jsonb) AS a(key text, name text, parent text)
    LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
    LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=a.parent
    LEFT JOIN pg_catalog.pg_constraint con ON con.conrelid=c.oid AND con.conname=a.name`,
  indexes: `SELECT a.key, CASE WHEN i.indexrelid IS NOT NULL THEN pg_catalog.jsonb_build_object(
    'definition', pg_catalog.pg_get_indexdef(i.indexrelid,0,false), 'valid', i.indisvalid,
    'ready', i.indisready, 'live', i.indislive, 'unique', i.indisunique,
    'nullsNotDistinct', i.indnullsnotdistinct) END AS actual
    FROM pg_catalog.jsonb_to_recordset($1::jsonb) AS a(key text, name text)
    LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
    LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=a.name
    LEFT JOIN pg_catalog.pg_index i ON i.indexrelid=c.oid`,
  triggers: `SELECT a.key, CASE WHEN tr.oid IS NOT NULL THEN pg_catalog.jsonb_build_object(
    'enabled', tr.tgenabled, 'definition', pg_catalog.pg_get_triggerdef(tr.oid,false),
    'functionDefinition', pg_catalog.pg_get_functiondef(tr.tgfoid)) END AS actual
    FROM pg_catalog.jsonb_to_recordset($1::jsonb) AS a(key text, name text, parent text)
    LEFT JOIN pg_catalog.pg_namespace n ON n.nspname='public'
    LEFT JOIN pg_catalog.pg_class c ON c.relnamespace=n.oid AND c.relname=a.parent
    LEFT JOIN pg_catalog.pg_trigger tr ON tr.tgrelid=c.oid AND tr.tgname=a.name AND NOT tr.tgisinternal`,
};

/** Sequential batched reads on the transaction's existing client. Names are data. */
export async function readSchemaAnchorCatalog(client, specifications) {
  const catalog = {};
  for (const [group, entries] of Object.entries(specifications)) {
    const result = await client.query(queries[group], [JSON.stringify(entries)]);
    const requested = new Set(entries.map(entry => entry.key));
    if (result.rows.length !== entries.length || new Set(result.rows.map(row => row.key)).size !== entries.length
      || result.rows.some(row => !requested.has(row.key))) {
      throw Object.assign(new Error('Schema anchor catalog observation was incomplete or ambiguous.'), { code: 'snapshot_anchor_catalog_invalid' });
    }
    catalog[group] = Object.fromEntries(result.rows.map(row => [row.key, row.actual]));
  }
  return catalog;
}
