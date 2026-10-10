/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { withTemporaryPostgresDatabase } from '../../postgres-temporary-database.js';
import { createParentPostgresClient } from '../parent-postgres-client.js';
import { resolveIntegrationTestRuntimeConfig } from '../runtime-config.js';

test('controlled owned PostgreSQL subprocess', { timeout: resolveIntegrationTestRuntimeConfig().scenarioTimeoutMs }, async (t) => {
  const mode = process.env.HARMONIARR_PARENT_PG_FIXTURE_MODE;
  assert.equal(['exit', 'hold', 'reserve_only'].includes(mode), true);
  if (mode === 'reserve_only') {
    await createParentPostgresClient().reserve('scenario');
    // Deliberately skip normal fixture teardown, without claiming CREATE.
    process.exit(42);
  }
  await withTemporaryPostgresDatabase({ run: async ({ getPoolFn }) => {
    await getPoolFn().query('CREATE TABLE controlled_child_data(value integer NOT NULL)');
    await getPoolFn().query('INSERT INTO controlled_child_data(value) VALUES (31)');
    if (mode === 'exit') {
      // The registered CREATE and data commits are durable before this abrupt
      // exit; the parent must recover the owned database after native close.
      process.exit(41);
    }
    const response = await fetch(process.env.HARMONIARR_PARENT_PG_FIXTURE_RELEASE_URL, { signal: t.signal });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'released');
  } });
});
