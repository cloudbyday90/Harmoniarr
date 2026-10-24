/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { buildQualityReviewCandidatePageQuery } from '../../src/server/import-candidates/import-candidate-quality-review-candidate-store.js';
import { explainPreparedPage } from './postgres-query-plan-evidence.js';

export const candidatePlanIndex = 'import_candidates_quality_review_page_idx';
export const candidatePlanId = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const corpusSize = 100_000;
const profiles = [ { name: 'first' }, { name: 'forward', afterId: candidatePlanId(90000) },
  { name: 'reverse', afterId: candidatePlanId(10000), direction: 'previous' },
  { name: 'forward-inclusive', afterId: candidatePlanId(90010), inclusive: true },
  { name: 'reverse-inclusive', afterId: candidatePlanId(10010), direction: 'previous', inclusive: true },
  { name: 'forward-eof', afterId: candidatePlanId(corpusSize) },
  { name: 'reverse-eof', afterId: candidatePlanId(1), direction: 'previous' } ];

export async function seedCandidatePlanCorpus(pool) {
  await pool.query(`INSERT INTO import_candidates
    (id,source_provider,source_search_id,source_response_key,username,folder_path,status,file_count,total_size_bytes,raw_payload,normalized_payload,discovered_at)
    SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,CASE WHEN n%2=0 THEN 'slskd' ELSE 'fixture' END,
      CASE WHEN n%5=0 THEN 'plan-target' WHEN n%101=0 THEN 'plan-sparse' ELSE 'other-'||(n%251) END,
      'row-'||n,'fixture-peer','fixture-folder',CASE n%4 WHEN 0 THEN 'failed' WHEN 1 THEN 'pending' WHEN 2 THEN 'held' ELSE 'selected' END,
      1,50000000,'{}',jsonb_build_object('extensions',jsonb_build_array('flac'),'fixturePadding',repeat('x',128)),NOW()
    FROM generate_series(1,$1::int) AS series(n)`, [corpusSize]);
  await pool.query('ANALYZE import_candidates');
}

function expectedIds(source, profile) {
  const ids = [];
  for (let n = 1; n <= corpusSize; n++) {
    if (n % 4 !== 1 && n % 4 !== 2) continue;
    if (source === 'plan-target' ? n % 5 !== 0 : n % 101 !== 0 || n % 5 === 0) continue;
    const id = candidatePlanId(n);
    if (profile.afterId && (profile.direction === 'previous'
      ? profile.inclusive ? id > profile.afterId : id >= profile.afterId
      : profile.inclusive ? id < profile.afterId : id <= profile.afterId)) continue;
    ids.push(id);
  }
  return (profile.direction === 'previous' ? ids.reverse() : ids).slice(0, 50);
}

/** Reuse the current projection; only reconstruct the historical nullable predicate. */
function legacyQuery(query, profile) {
  if (profile.afterId) return { ...query,
    text: query.text.replace(/AND (id[<>]=?\$2::uuid)/u, 'AND ($2::uuid IS NULL OR $1)') };
  return { text: query.text.replace('ORDER BY id', 'AND ($2::uuid IS NULL OR id>$2::uuid) ORDER BY id').replace('LIMIT $2', 'LIMIT $3'),
    values: [query.values[0], null, 50] };
}

export async function qualifyCandidateQueryPlans({ pool, installIndex, evidencePath = null }) {
  await seedCandidatePlanCorpus(pool);
  const expected = new Map(['plan-target', 'plan-sparse'].flatMap(source => profiles.map(profile =>
    [`${source}/${profile.name}`, expectedIds(source, profile)])));
  const client = await pool.connect(); const rows = [];
  try {
    for (const phase of ['baseline', 'query-only', 'index-only', 'combined']) {
      if (phase === 'index-only') await installIndex();
      for (const source of ['plan-target', 'plan-sparse']) for (const mode of ['force_custom_plan', 'force_generic_plan']) {
        for (const lockRows of [false, true]) for (const profile of profiles) {
          const query = buildQualityReviewCandidatePageQuery({ sourceSearchId: source, ...profile, lockRows });
          const legacy = phase === 'baseline' || phase === 'index-only';
          const result = await explainPreparedPage(client, legacy ? legacyQuery(query, profile) : query, mode);
          assert.deepEqual(result.ids, expected.get(`${source}/${profile.name}`), `${phase}/${source}/${mode}/${lockRows}/${profile.name}`);
          if (phase === 'combined' && mode === 'force_generic_plan') {
            const index = result.indexes.find(entry => entry.name === candidatePlanIndex);
            assert.ok(index, 'The generic scoped range must use the partial index');
            assert.match(index.condition, /source_search_id/u);
            if (profile.afterId) assert.match(index.condition, /id [<>]=? \$2/u);
            assert.equal(result.rejectedRows, 0); assert.equal(result.hasSort, false);
            assert.equal(result.examinedRows, result.ids.length);
          }
          rows.push({ phase, source, mode, lockRows, case: profile.name, ...result });
        }
      }
    }
    const first = phase => rows.find(row => row.phase === phase && row.source === 'plan-sparse'
      && row.mode === 'force_custom_plan' && !row.lockRows && row.case === 'first');
    assert.ok(first('baseline').examinedRows > first('combined').examinedRows);
    assert.equal(first('combined').examinedRows, 50);
    const version = (await client.query('SHOW server_version')).rows[0].server_version;
    const indexBytes = (await client.query('SELECT pg_relation_size($1::regclass)::int AS bytes', [candidatePlanIndex])).rows[0].bytes;
    const result = { version, corpusSize, indexBytes, profiles: rows.length, rows };
    if (evidencePath) await writeFile(evidencePath, JSON.stringify(result, null, 2), { flag: 'wx' });
    return result;
  } finally { client.release(); }
}
