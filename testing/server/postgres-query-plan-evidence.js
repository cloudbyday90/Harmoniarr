/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

function planNodes(node) {
  return [node, ...(node.Plans ?? []).flatMap(planNodes)];
}

export function summarizePostgresQueryPlan(document) {
  const nodes = planNodes(document.Plan);
  const scans = nodes.filter(node => ['Index Scan', 'Index Only Scan', 'Seq Scan', 'Bitmap Heap Scan'].includes(node['Node Type']));
  const removed = node => (node['Rows Removed by Filter'] ?? 0) + (node['Rows Removed by Index Recheck'] ?? 0);
  return {
    examinedRows: scans.reduce((sum, node) => sum + (node['Actual Rows'] + removed(node)) * node['Actual Loops'], 0),
    rejectedRows: scans.reduce((sum, node) => sum + removed(node) * node['Actual Loops'], 0),
    bufferAccesses: (document.Plan['Shared Hit Blocks'] ?? 0) + (document.Plan['Shared Read Blocks'] ?? 0),
    hasSort: nodes.some(node => /Sort/u.test(node['Node Type'])),
    indexes: nodes.filter(node => node['Index Name']).map(node => ({ name: node['Index Name'], condition: node['Index Cond'] ?? null })),
    executionMs: document['Execution Time'],
  };
}

function sqlLiteral(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (typeof value !== 'string') throw new TypeError('Unsupported plan fixture parameter');
  return `'${value.replaceAll("'", "''")}'`;
}

/** Disposable SELECT fixtures only; cache controls and row locks retire per profile. */
export async function explainPreparedPage(client, query, mode) {
  if (!['force_custom_plan', 'force_generic_plan'].includes(mode)) throw new TypeError('Invalid plan fixture cache mode');
  const types = query.values.length === 3 ? 'text,uuid,bigint' : 'text,bigint';
  let prepared = false; let failed = false; let failure; let result;
  await client.query('BEGIN');
  try {
    await client.query(`SET LOCAL plan_cache_mode=${mode}`);
    await client.query("SET LOCAL statement_timeout='30s'");
    await client.query(`PREPARE candidate_page_profile(${types}) AS ${query.text}`); prepared = true;
    const execute = `EXECUTE candidate_page_profile(${query.values.map(sqlLiteral).join(',')})`;
    const document = (await client.query(`EXPLAIN (ANALYZE,BUFFERS,TIMING OFF,FORMAT JSON) ${execute}`)).rows[0]['QUERY PLAN'][0];
    const rows = (await client.query(execute)).rows;
    result = { ids: rows.map(row => row.id), ...summarizePostgresQueryPlan(document), plan: document };
  } catch (error) { failed = true; failure = error; }
  let cleanupError; let cleanupFailed = false;
  for (const command of ['ROLLBACK', ...(prepared ? ['DEALLOCATE candidate_page_profile'] : [])]) {
    try { await client.query(command); }
    catch (error) { if (!cleanupFailed) { cleanupError = error; cleanupFailed = true; } }
  }
  if (failed) throw failure;
  if (cleanupFailed) throw cleanupError;
  return result;
}
