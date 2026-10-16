/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

export function createIntegrationTestEnvironment(env = process.env) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) throw new TypeError('Invalid integration environment');
  const result = {};
  for (const [key, value] of Object.entries(env)) {
    if (/^(?:PG|POSTGRES_|HARMONIARR_TEST_PG_)/iu.test(key)
      || ['NODE_OPTIONS', 'NODE_TEST_CONTEXT', 'TESTCONTAINERS_REUSE_ENABLE',
        'HARMONIARR_INTEGRATION_USE_CONTAINER_REUSE'].includes(key.toUpperCase())) continue;
    if (value !== undefined && typeof value !== 'string') throw new TypeError('Invalid integration environment value');
    result[key] = value;
  }
  return Object.freeze({ ...result, HARMONIARR_INTEGRATION_USE_CONTAINER_REUSE: 'false', TESTCONTAINERS_REUSE_ENABLE: 'false' });
}
