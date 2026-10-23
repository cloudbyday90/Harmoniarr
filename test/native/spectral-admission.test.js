/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { buildPoolConfig, getPool, closePool } from '../../src/server/database.js';
import { requireDeploymentMemoryProfile } from '../../testing/server/deployment-memory-profile.js';
import { registerSpectralAdmissionTests } from '../../testing/server/spectral-admission-cases.js';

// Refuse live/host data before acquiring the packaged, container-local database.
await requireDeploymentMemoryProfile();
registerSpectralAdmissionTests({
  config: { scenarioTimeoutMs: 60_000, suiteSetupTimeoutMs: 30_000, suiteTeardownTimeoutMs: 30_000 },
  createRuntime: async () => ({
    async runIsolatedDatabase(work) {
      await getPool().query('TRUNCATE source_user_spectral_jobs');
      return work({ getPoolFn: getPool, databaseConfig: buildPoolConfig(process.env) });
    },
    cleanup: closePool,
  }),
});
