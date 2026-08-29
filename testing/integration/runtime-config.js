/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

function parseOptionalInteger(value, name) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer when configured`);
  }

  return parsed;
}

function parsePositiveInteger(value, name, fallback) {
  const parsed = parseOptionalInteger(value, name);
  if (parsed === undefined) {
    return fallback;
  }

  if (parsed <= 0) {
    throw new Error(`${name} must be greater than 0`);
  }

  return parsed;
}

function parseBoolean(value, name, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  throw new Error(`${name} must be "true" or "false" when configured`);
}

export function resolveIntegrationTestRuntimeConfig(env = process.env) {
  return {
    browserActionTimeoutMs: parsePositiveInteger(
      env.HARMONIARR_INTEGRATION_BROWSER_ACTION_TIMEOUT_MS,
      'HARMONIARR_INTEGRATION_BROWSER_ACTION_TIMEOUT_MS',
      30_000,
    ),
    containerStopTimeoutMs: parsePositiveInteger(
      env.HARMONIARR_INTEGRATION_CONTAINER_STOP_TIMEOUT_MS,
      'HARMONIARR_INTEGRATION_CONTAINER_STOP_TIMEOUT_MS',
      10_000,
    ),
    httpRequestTimeoutMs: parsePositiveInteger(
      env.HARMONIARR_INTEGRATION_HTTP_REQUEST_TIMEOUT_MS,
      'HARMONIARR_INTEGRATION_HTTP_REQUEST_TIMEOUT_MS',
      15_000,
    ),
    keepArtifactsOnFailure: parseBoolean(
      env.HARMONIARR_INTEGRATION_KEEP_ARTIFACTS_ON_FAILURE,
      'HARMONIARR_INTEGRATION_KEEP_ARTIFACTS_ON_FAILURE',
      false,
    ),
    poolAllowExitOnIdle: parseBoolean(
      env.HARMONIARR_INTEGRATION_PG_POOL_ALLOW_EXIT_ON_IDLE,
      'HARMONIARR_INTEGRATION_PG_POOL_ALLOW_EXIT_ON_IDLE',
      true,
    ),
    poolConnectionTimeoutMs: parsePositiveInteger(
      env.HARMONIARR_INTEGRATION_PG_POOL_CONNECTION_TIMEOUT_MS,
      'HARMONIARR_INTEGRATION_PG_POOL_CONNECTION_TIMEOUT_MS',
      10_000,
    ),
    poolIdleTimeoutMs: parsePositiveInteger(
      env.HARMONIARR_INTEGRATION_PG_POOL_IDLE_TIMEOUT_MS,
      'HARMONIARR_INTEGRATION_PG_POOL_IDLE_TIMEOUT_MS',
      1_000,
    ),
    poolMax: parsePositiveInteger(
      env.HARMONIARR_INTEGRATION_PG_POOL_MAX,
      'HARMONIARR_INTEGRATION_PG_POOL_MAX',
      2,
    ),
    poolMaxUses: parsePositiveInteger(
      env.HARMONIARR_INTEGRATION_PG_POOL_MAX_USES,
      'HARMONIARR_INTEGRATION_PG_POOL_MAX_USES',
      25,
    ),
    postgresImage: env.HARMONIARR_INTEGRATION_POSTGRES_IMAGE ?? 'postgres:18-alpine',
    scenarioTimeoutMs: parsePositiveInteger(
      env.HARMONIARR_INTEGRATION_SCENARIO_TIMEOUT_MS,
      'HARMONIARR_INTEGRATION_SCENARIO_TIMEOUT_MS',
      90_000,
    ),
    startupTimeoutMs: parsePositiveInteger(
      env.HARMONIARR_INTEGRATION_STARTUP_TIMEOUT_MS,
      'HARMONIARR_INTEGRATION_STARTUP_TIMEOUT_MS',
      120_000,
    ),
    suiteSetupTimeoutMs: parsePositiveInteger(
      env.HARMONIARR_INTEGRATION_SUITE_SETUP_TIMEOUT_MS,
      'HARMONIARR_INTEGRATION_SUITE_SETUP_TIMEOUT_MS',
      150_000,
    ),
    suiteTeardownTimeoutMs: parsePositiveInteger(
      env.HARMONIARR_INTEGRATION_SUITE_TEARDOWN_TIMEOUT_MS,
      'HARMONIARR_INTEGRATION_SUITE_TEARDOWN_TIMEOUT_MS',
      30_000,
    ),
    useContainerReuse: parseBoolean(
      env.HARMONIARR_INTEGRATION_USE_CONTAINER_REUSE,
      'HARMONIARR_INTEGRATION_USE_CONTAINER_REUSE',
      false,
    ),
  };
}
