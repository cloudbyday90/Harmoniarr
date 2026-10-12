/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildIntegrationPoolConfig, buildIntegrationPoolEnvironment } from '../../testing/integration/pool-policy.js';
import { buildPoolConfig } from '../../src/server/database.js';

test('direct and app fixture policy share bounded defaults, including partial injected configs', () => {
  const defaults = { allowExitOnIdle: true, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 1000, max: 2, maxUses: 25 };
  assert.deepEqual(buildIntegrationPoolConfig({ containerStopTimeoutMs: 1234 }), defaults);
  const appConfig = buildPoolConfig(buildIntegrationPoolEnvironment());
  for (const [key, value] of Object.entries(defaults)) assert.equal(appConfig[key], value);
});

test('explicit non-default fixture limits and false exit policy survive both entrypoints', () => {
  const config = { poolAllowExitOnIdle: false, poolConnectionTimeoutMs: 1250,
    poolIdleTimeoutMs: 500, poolMax: 3, poolMaxUses: 7 };
  const policy = buildIntegrationPoolConfig(config);
  assert.deepEqual(policy, { allowExitOnIdle: false, connectionTimeoutMillis: 1250, idleTimeoutMillis: 500, max: 3, maxUses: 7 });
  const appConfig = buildPoolConfig(buildIntegrationPoolEnvironment(config));
  for (const [key, value] of Object.entries(policy)) assert.equal(appConfig[key], value);
});
