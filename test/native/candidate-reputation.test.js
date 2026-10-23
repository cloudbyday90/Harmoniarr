/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { buildPoolConfig, getPool, closePool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { registerCandidateReputationTests } from '../../testing/server/candidate-reputation-cases.js';
await requireDeploymentMemoryProfile();
registerCandidateReputationTests({
  config: { scenarioTimeoutMs: 60_000, suiteSetupTimeoutMs: 30_000, suiteTeardownTimeoutMs: 30_000 },
  createRuntime: async () => ({
    async runIsolatedDatabase(work) {
      await getPool().query('TRUNCATE import_candidates, app_users, metadata_artists, operation_runs, source_user_outcome_events, recovery_trust_snapshots CASCADE');
      return work({ getPoolFn: getPool, databaseConfig: buildPoolConfig(process.env) });
    },
    cleanup: closePool,
  }),
});
