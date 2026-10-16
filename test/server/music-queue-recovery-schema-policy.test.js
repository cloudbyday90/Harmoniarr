/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveMusicQueueRecoverySchemaMode, resolveMusicQueueRecoveryExecutionSchemaMode, resolveMusicQueueRecoveryDiscoverySchemaMode }
  from '../../testing/integration/music-queue-recovery-schema-policy.js';

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
test('execution selects the template default and keeps an independent explicit policy from recovery transactions', () => {
  assert.equal(resolveMusicQueueRecoveryExecutionSchemaMode({ env: {} }), 'migration_template');
  for (const mode of ['empty', 'migration_template']) {
    assert.equal(resolveMusicQueueRecoveryExecutionSchemaMode({ env: {}, defaultMode: mode }), mode);
    const env = Object.freeze({ HARMONIARR_INTEGRATION_RECOVERY_EXECUTION_SCHEMA_MODE: mode,
      HARMONIARR_INTEGRATION_RECOVERY_SCHEMA_MODE: mode === 'empty' ? 'migration_template' : 'empty' });
    assert.equal(resolveMusicQueueRecoveryExecutionSchemaMode({ env }), mode);
    assert.notEqual(resolveMusicQueueRecoverySchemaMode({ env }), mode);
  }
  assert.equal(resolveMusicQueueRecoveryExecutionSchemaMode({ env: { HARMONIARR_INTEGRATION_RECOVERY_SCHEMA_MODE: 'invalid' } }), 'migration_template');
});
test('invalid execution mode refuses before allocation without reflecting configured contents', () => {
  for (const mode of ['', 'EMPTY', null, false, [], 'private-password']) {
    assert.throws(() => resolveMusicQueueRecoveryExecutionSchemaMode({ env: { HARMONIARR_INTEGRATION_RECOVERY_EXECUTION_SCHEMA_MODE: mode } }),
      error => error instanceof TypeError && !error.message.includes('private-password'));
  }
  for (const env of [null, [], false]) assert.throws(() => resolveMusicQueueRecoveryExecutionSchemaMode({ env }), TypeError);
  assert.throws(() => resolveMusicQueueRecoveryExecutionSchemaMode({ env: {}, defaultMode: 'shared' }), TypeError);
});
test('discovery selects its template default and retains explicit modes independently of other recovery suites', () => {
  assert.equal(resolveMusicQueueRecoveryDiscoverySchemaMode({ env: {} }), 'migration_template');
  for (const mode of ['empty', 'migration_template']) {
    assert.equal(resolveMusicQueueRecoveryDiscoverySchemaMode({ env: {}, defaultMode: mode }), mode);
    const env = Object.freeze({ HARMONIARR_INTEGRATION_RECOVERY_DISCOVERY_SCHEMA_MODE: mode,
      HARMONIARR_INTEGRATION_RECOVERY_SCHEMA_MODE: 'invalid', HARMONIARR_INTEGRATION_RECOVERY_EXECUTION_SCHEMA_MODE: 'invalid' });
    assert.equal(resolveMusicQueueRecoveryDiscoverySchemaMode({ env }), mode);
  }
  assert.equal(resolveMusicQueueRecoveryDiscoverySchemaMode({ env: { HARMONIARR_INTEGRATION_RECOVERY_EXECUTION_SCHEMA_MODE: 'empty' } }), 'migration_template');
});
test('invalid discovery mode/default/environment refuses without reflecting configured contents', () => {
  for (const mode of ['', 'EMPTY', null, false, [], 'private-password']) {
    assert.throws(() => resolveMusicQueueRecoveryDiscoverySchemaMode({ env: { HARMONIARR_INTEGRATION_RECOVERY_DISCOVERY_SCHEMA_MODE: mode } }),
      error => error instanceof TypeError && !error.message.includes('private-password'));
  }
  for (const env of [null, [], false]) assert.throws(() => resolveMusicQueueRecoveryDiscoverySchemaMode({ env }), TypeError);
  assert.throws(() => resolveMusicQueueRecoveryDiscoverySchemaMode({ env: {}, defaultMode: 'shared' }), TypeError);
});
