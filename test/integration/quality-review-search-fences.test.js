/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { bootstrapDatabaseSchemaFromSnapshot } from '../../src/server/schema-bootstrap.js';
import { qualifyQualityReviewSearchFences } from '../../testing/server/quality-review-search-fence-fixture.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

let runtime; const config = resolveIntegrationTestRuntimeConfig();
before(async () => { runtime = await createPostgresIntegrationRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
test('actual candidate/revision inversion refuses without waiting and the fence orders later inserts', { timeout: config.scenarioTimeoutMs }, async () => {
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await bootstrapDatabaseSchemaFromSnapshot({ getPoolFn });
    assert.equal((await qualifyQualityReviewSearchFences({ pool: getPoolFn() })).inversionRefusedNowait, true);
  });
});
