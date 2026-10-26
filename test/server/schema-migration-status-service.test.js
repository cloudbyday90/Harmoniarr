/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readMigrationStatus } from '../../src/server/schema-migration-status-service.js';

test('migration status observes applied filenames with one SELECT and no schema preparation', async () => {
  const queries = [];
  const result = await readMigrationStatus({
    listMigrationFilesFn: async () => [{ filename: 'first.sql' }, { filename: 'second.sql' }],
    queryable: { query: async sql => { queries.push(sql); return { rows: [{ filename: 'first.sql' }] }; } },
  });
  assert.deepEqual(result, { available: 2, applied: 1, pending: ['second.sql'] });
  assert.deepEqual(queries, ["SELECT filename FROM schema_migrations WHERE status = 'applied' ORDER BY filename ASC"]);
});

test('migration status propagates missing schema and database failures without attempting repair', async () => {
  for (const original of [Object.assign(new Error('missing schema'), { code: '42P01' }), null]) {
    let calls = 0;
    await assert.rejects(readMigrationStatus({ listMigrationFilesFn: async () => [],
      queryable: { query: async sql => { calls++; assert.match(sql, /^SELECT /u); throw original; } },
    }), error => error === original);
    assert.equal(calls, 1);
  }
});

test('migration manifest failures propagate before database observation', async () => {
  const original = new Error('manifest unavailable'); let calls = 0;
  await assert.rejects(readMigrationStatus({ listMigrationFilesFn: async () => { throw original; },
    queryable: { query: async () => { calls++; } },
  }), error => error === original);
  assert.equal(calls, 0);
});
