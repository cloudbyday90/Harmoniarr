/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { updateSchemaAnchorContract } from '../../scripts/schema-anchor-contract.js';
import { withPreparationLockFixture } from '../../testing/server/preparation-lock-fixture.js';

const artifact = await readFile(new URL('../../src/server/schema-anchor-contract.json', import.meta.url), 'utf8');
const expected = JSON.parse(artifact);
function source({ mutate, cleanupFailure } = {}) {
  const anchors = structuredClone(expected.anchors); let status = 'I';
  if (mutate) mutate(anchors);
  const client = withPreparationLockFixture({
    getTransactionStatus: () => status, release() {}, async query(sql, values) {
      if (sql === 'BEGIN') status = 'T';
      if (sql === 'COMMIT' || sql === 'ROLLBACK') { status = 'I'; return { command: sql }; }
      if (sql.includes('current_setting')) return { rows: [{ version: 180006, search_path: 'public' }] };
      if (sql.includes('jsonb_to_recordset')) {
        const entries = JSON.parse(values[0]), groups = { table: 'tables', column: 'columns', constraint: 'constraints', index: 'indexes', trigger: 'triggers' };
        return { rows: entries.map(({ key }) => ({ key, actual: anchors[groups[key.split('.')[0]]][key] })).reverse() };
      }
      return { rows: [] };
    },
  });
  return async ({ run }) => {
    const result = await run({ getPoolFn: () => ({ connect: async () => client }) });
    if (cleanupFailure) throw cleanupFailure;
    return result;
  };
}

test('anchor generator reproduces canonical artifact independently of catalog row ordering', async () => {
  let written = 0;
  const result = await updateSchemaAnchorContract({ prepareSchemaSourceFn: source(), writeFileFn: async (_path, content) => {
    written++; assert.equal(content, artifact);
  } });
  assert.equal(result.anchorCount, 164); assert.equal(written, 1);
});

test('anchor generator refuses incomplete source facts without writing a replacement artifact', async () => {
  await assert.rejects(updateSchemaAnchorContract({
    prepareSchemaSourceFn: source({ mutate: anchors => { anchors.tables['table.operation_runs'] = null; } }),
    writeFileFn: async () => assert.fail('invalid contract written'),
  }), { code: 'snapshot_anchor_contract_invalid' });
});

test('anchor generator waits for source completion before writing its artifact', async () => {
  const failure = new Error('source cleanup failed');
  await assert.rejects(updateSchemaAnchorContract({ prepareSchemaSourceFn: source({ cleanupFailure: failure }),
    writeFileFn: async () => assert.fail('contract written before source completed'),
  }), error => error === failure);
});
