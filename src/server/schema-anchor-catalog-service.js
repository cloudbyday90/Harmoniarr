/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { readSchemaAnchorCatalog } from './schema-anchor-catalog-store.js';
import { schemaAnchorSpecifications } from './schema-anchor-contract-policy.js';
import { withWorkerTaskCleanup } from './worker-task-cleanup.js';

/** Canonical deparser context only after DDL; never change CREATE's target schema. */
export async function inspectSchemaAnchorCatalog(client) {
  if (client.getTransactionStatus?.() !== 'T') throw new Error('Schema anchor inspection requires an active owned transaction.');
  const { rows: [context] } = await client.query(`SELECT pg_catalog.current_setting('search_path') AS search_path,
    pg_catalog.current_setting('server_version_num')::integer AS version`);
  if (Math.trunc(context.version / 10000) !== 18) {
    throw Object.assign(new Error('Schema anchor contract requires PostgreSQL 18.'), { code: 'snapshot_anchor_postgres_unsupported' });
  }
  return withWorkerTaskCleanup(async () => {
    await client.query("SELECT pg_catalog.set_config('search_path',$1,true)", ['pg_catalog']);
    return readSchemaAnchorCatalog(client, schemaAnchorSpecifications);
  }, () => client.query("SELECT pg_catalog.set_config('search_path',$1,true)", [context.search_path]));
}
