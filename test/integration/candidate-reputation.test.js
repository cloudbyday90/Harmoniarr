/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createPostgresIntegrationRuntime } from '../../testing/postgres-integration-runtime.js';
import { resolveIntegrationTestRuntimeConfig } from '../../testing/integration/runtime-config.js';
import { registerCandidateReputationTests } from '../../testing/server/candidate-reputation-cases.js';
const config = resolveIntegrationTestRuntimeConfig();
registerCandidateReputationTests({ config, createRuntime: () => createPostgresIntegrationRuntime({ config, env: {} }) });
