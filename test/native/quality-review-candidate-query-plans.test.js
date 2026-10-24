/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { getPool, closePool } from '../../src/server/database.js';
import { loadMigrationManifest } from '../../src/server/migration-manifest.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { candidatePlanIndex, qualifyCandidateQueryPlans } from '../../testing/server/quality-review-candidate-plan-fixture.js';

await requireDeploymentMemoryProfile();
after(closePool);
test('packaged PostgreSQL qualifies the shared candidate plan matrix on disposable tmpfs data', { timeout: 180_000 }, async () => {
  const pool = getPool();
  assert.equal((await pool.query('SELECT count(*)::int AS count FROM import_candidates')).rows[0].count, 0);
  const migration = (await loadMigrationManifest()).at(-1);
  assert.match(migration.filename, /quality_review_candidate_keyset_index\.sql$/u);
  await pool.query(`DROP INDEX ${candidatePlanIndex}`);
  const result = await qualifyCandidateQueryPlans({ pool, installIndex: () => pool.query(migration.sql),
    evidencePath: process.env.HARMONIARR_CANDIDATE_PLAN_EVIDENCE_PATH });
  assert.equal(result.profiles, 224);
  console.info(JSON.stringify({ version: result.version, profiles: result.profiles, corpusSize: result.corpusSize, indexBytes: result.indexBytes }));
});
