/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { before, after, suite, test } from 'node:test';
import { createApp } from '../../src/server/app.js';
import { createActivityModule } from '../../src/server/activity/activity-module.js';
import { getPool } from '../../src/server/database.js';
import { seedImportCandidateFixture } from '../../testing/integration/import-candidate-fixtures.js';
import { createSourceUserOutcomeLedgerStore } from '../../src/server/activity/source-user-outcome-ledger-store.js';
import { createIntegrationAppRuntime, withIntegrationApp } from '../../testing/integration/app-runtime.js';
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';

const config = resolveIntegrationTestRuntimeConfig(); let postgres;
suite('candidate reputation canonical application composition', () => {
  before(async () => { postgres = await createPostgresIntegrationRuntime({ config, env: {} }); }, { timeout: config.suiteSetupTimeoutMs });
  after(async () => { await postgres?.cleanup(); }, { timeout: config.suiteTeardownTimeoutMs });
  for (const entrypoint of ['functional', 'reusable']) {
    test(`${entrypoint} supplies transaction-capable reputation through the actual app module`, { timeout: config.scenarioTimeoutMs }, async () => {
      let application;
      const createAppFn = options => {
        application = createApp({ ...options, createActivityModule: dependencies => createActivityModule({ ...dependencies,
          sourceUserIgnoreService: { evaluateAutoIgnoreForUser: async () => {} },
        }) });
        return application;
      };
      const run = async () => {
        const candidate = await seedImportCandidateFixture({ queryable: getPool(), candidateOverrides: { status: 'downloading' } });
        const result = await application.importCandidateModule.importCandidateService.markImportCandidateDownloadFailed({ importCandidateId: candidate.id });
        const [event] = await createSourceUserOutcomeLedgerStore().listRecentOutcomeEvents();
        assert.equal(event.id, result.event.id);
        const { sourceUsers } = await application.activityModule.sourceUserTrustService.listSourceUsers();
        assert.equal(sourceUsers[0].reputation.failureCount, 1);
        assert.equal(sourceUsers[0].username, candidate.username);
      };
      if (entrypoint === 'functional') {
        await withIntegrationApp({ config, createAppFn,
          withPostgresIntegrationRuntimeFn: ({ run: scenario, phaseObserver }) => postgres.runIsolatedDatabase(scenario, { phaseObserver }), run });
      } else {
        const runtime = await createIntegrationAppRuntime({ config, createAppFn,
          postgresRuntimeFactory: async () => ({ ...postgres, cleanup: async () => {} }) });
        try { await runtime.runScenario(run, { scenarioName: 'candidate_reputation' }); }
        finally { await runtime.cleanup(); }
      }
    });
  }
});
