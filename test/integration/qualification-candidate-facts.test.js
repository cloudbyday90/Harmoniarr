/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { bootstrapDatabaseSchemaFromSnapshot } from '../../src/server/schema-bootstrap.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { qualifyQualificationCandidateFacts } from '../../testing/server/qualification-candidate-facts-fixture.js';

const config = resolveIntegrationTestRuntimeConfig(); let runtime;
before(async () => { runtime = await createPostgresIntegrationRuntime(); }, { timeout: config.suiteSetupTimeoutMs });
after(async () => { await runtime?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
test('real SQL minimal facts preserve policy parity and the proven parent/child lock boundary', { timeout: config.scenarioTimeoutMs }, async () => {
  await runtime.runIsolatedDatabase(async ({ getPoolFn }) => {
    await bootstrapDatabaseSchemaFromSnapshot({ getPoolFn });
    const result = await qualifyQualificationCandidateFacts({ pool: getPoolFn() }); assert.ok(result.policyCases >= 25);
    if (process.env.HARMONIARR_QUALIFICATION_FACTS_EVIDENCE_PATH) {
      const { writeFile } = await import('node:fs/promises');
      await writeFile(process.env.HARMONIARR_QUALIFICATION_FACTS_EVIDENCE_PATH, JSON.stringify(result), { flag: 'wx' });
    }
  });
});
