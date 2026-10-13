/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectSchemaAnchors, compareSchemaAnchorSnapshots } from '../../src/server/schema-anchor-service.js';

const anchors = { triggers: [{ table: 'app_users', trigger: 'authority' }] };
const inspect = row => inspectSchemaAnchors({ anchors, client: { query: async (_sql, values) => {
  assert.deepEqual(values, ['public', 'app_users', 'authority']); return { rows: row ? [row] : [] };
} } });
const original = { enabled: 'O', definition: 'BEFORE UPDATE ON app_users', function_definition: 'FUNCTION guarded()' };

test('missing, disabled and replication-only triggers cannot satisfy a critical anchor', async () => {
  const source = await inspect(original);
  for (const row of [null, { ...original, enabled: 'D' }, { ...original, enabled: 'R' }]) {
    const comparison = compareSchemaAnchorSnapshots({ source, snapshot: await inspect(row) });
    assert.equal(comparison.clean, false); assert.equal(comparison.snapshotMissing.length, 1);
  }
});

test('trigger event/timing or function-body drift refuses a matching named anchor', async () => {
  const source = await inspect(original);
  for (const row of [{ ...original, definition: 'AFTER UPDATE ON app_users' },
    { ...original, function_definition: 'FUNCTION bypassed()' }]) {
    const comparison = compareSchemaAnchorSnapshots({ source, snapshot: await inspect(row) });
    assert.equal(comparison.clean, false); assert.equal(comparison.mismatches[0].group, 'triggers');
  }
  assert.equal(compareSchemaAnchorSnapshots({ source, snapshot: await inspect({ ...original,
    definition: '  BEFORE\n UPDATE ON app_users ' }) }).clean, true);
  assert.equal(compareSchemaAnchorSnapshots({ source: await inspect({ ...original,
    function_definition: "FUNCTION guarded('a  b')" }), snapshot: await inspect({ ...original,
    function_definition: "FUNCTION guarded('a b')" }) }).clean, false);
});
