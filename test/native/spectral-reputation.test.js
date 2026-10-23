/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { buildPoolConfig, getPool, closePool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { registerSpectralReputationTests } from '../../testing/server/spectral-reputation-cases.js';
await requireDeploymentMemoryProfile();
registerSpectralReputationTests({
  config: { scenarioTimeoutMs: 60_000, suiteSetupTimeoutMs: 30_000, suiteTeardownTimeoutMs: 30_000 },
  createRuntime: async () => ({
    async runIsolatedDatabase(work) {
      await getPool().query('TRUNCATE source_user_spectral_jobs, source_user_spectral_cache, source_user_outcome_events, recovery_trust_snapshots');
      return work({ getPoolFn: getPool, databaseConfig: buildPoolConfig(process.env) });
    },
    cleanup: closePool,
  }),
});
