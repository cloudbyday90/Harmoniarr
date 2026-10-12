/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { resolveIntegrationTestRuntimeConfig } from './runtime-config.js';

/** Explicit fixture policy wins over ambient production/driver pool settings. */
export function buildIntegrationPoolConfig(config = {}) {
  const defaults = resolveIntegrationTestRuntimeConfig({});
  return {
    allowExitOnIdle: config.poolAllowExitOnIdle ?? defaults.poolAllowExitOnIdle,
    connectionTimeoutMillis: config.poolConnectionTimeoutMs ?? defaults.poolConnectionTimeoutMs,
    idleTimeoutMillis: config.poolIdleTimeoutMs ?? defaults.poolIdleTimeoutMs,
    max: config.poolMax ?? defaults.poolMax,
    maxUses: config.poolMaxUses ?? defaults.poolMaxUses,
  };
}

export function buildIntegrationPoolEnvironment(config) {
  const policy = buildIntegrationPoolConfig(config);
  return {
    HARMONIARR_PG_POOL_ALLOW_EXIT_ON_IDLE: String(policy.allowExitOnIdle),
    HARMONIARR_PG_POOL_CONNECTION_TIMEOUT_MS: String(policy.connectionTimeoutMillis),
    HARMONIARR_PG_POOL_IDLE_TIMEOUT_MS: String(policy.idleTimeoutMillis),
    HARMONIARR_PG_POOL_MAX: String(policy.max),
    HARMONIARR_PG_POOL_MAX_USES: String(policy.maxUses),
  };
}
