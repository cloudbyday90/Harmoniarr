/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveMusicQueueRecoverySchemaMode } from '../../testing/integration/music-queue-recovery-schema-policy.js';

test('recovery schema policy selects the template default and retains an explicit empty comparator', () => {
  assert.equal(resolveMusicQueueRecoverySchemaMode({ env: {} }), 'migration_template');
  for (const mode of ['empty', 'migration_template']) {
    const env = Object.freeze({ HARMONIARR_INTEGRATION_RECOVERY_SCHEMA_MODE: mode });
    assert.equal(resolveMusicQueueRecoverySchemaMode({ env }), mode);
    assert.equal(resolveMusicQueueRecoverySchemaMode({ env: {}, defaultMode: mode }), mode);
  }
});
test('invalid recovery schema policy refuses instead of silently changing fixture ownership', () => {
  for (const mode of ['', 'shared', 'EMPTY', false, 1, null]) {
    assert.throws(() => resolveMusicQueueRecoverySchemaMode({ env: { HARMONIARR_INTEGRATION_RECOVERY_SCHEMA_MODE: mode } }), TypeError);
  }
  for (const env of [null, [], false]) assert.throws(() => resolveMusicQueueRecoverySchemaMode({ env }), TypeError);
  assert.throws(() => resolveMusicQueueRecoverySchemaMode({ env: {}, defaultMode: 'shared' }), TypeError);
});
