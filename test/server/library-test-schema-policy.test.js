/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveLibraryTestSchemaMode, libraryTestSchemaEnvironmentKeys } from '../../testing/integration/library-test-schema-policy.js';

test('suite defaults and explicit empty/template overrides select only supported modes', () => {
  for (const domain of Object.keys(libraryTestSchemaEnvironmentKeys)) {
    for (const defaultMode of ['empty', 'migration_template']) {
      assert.equal(resolveLibraryTestSchemaMode({ domain, env: {}, defaultMode }), defaultMode);
      for (const mode of ['empty', 'migration_template']) {
        assert.equal(resolveLibraryTestSchemaMode({ domain, env: { [libraryTestSchemaEnvironmentKeys[domain]]: mode }, defaultMode }), mode);
      }
    }
  }
});
test('per-domain overrides cannot retarget another domain or inherit Wanted mode', () => {
  const env = { HARMONIARR_INTEGRATION_RELEASE_SCHEMA_MODE: 'empty',
    HARMONIARR_INTEGRATION_CATALOGUE_SCHEMA_MODE: 'empty',
    HARMONIARR_INTEGRATION_TAG_SCHEMA_MODE: 'migration_template', HARMONIARR_INTEGRATION_WANTED_SCHEMA_MODE: 'malformed' };
  assert.equal(resolveLibraryTestSchemaMode({ domain: 'release_reconciliation', env, defaultMode: 'migration_template' }), 'empty');
  assert.equal(resolveLibraryTestSchemaMode({ domain: 'tag_snapshot', env }), 'migration_template');
  assert.equal(resolveLibraryTestSchemaMode({ domain: 'catalogue', env, defaultMode: 'migration_template' }), 'empty');
});
test('unknown, null, empty and non-string configured modes refuse without fallback or reflecting their contents', () => {
  for (const domain of Object.keys(libraryTestSchemaEnvironmentKeys)) {
    for (const value of ['', null, false, [], 'snapshot', 'private-password']) {
      assert.throws(() => resolveLibraryTestSchemaMode({ domain,
        env: { [libraryTestSchemaEnvironmentKeys[domain]]: value }, defaultMode: 'migration_template' }),
      (error) => error instanceof TypeError && !error.message.includes('private-password'));
    }
  }
});
test('unsupported owners and defaults cannot select a library template mode', () => {
  for (const domain of ['wanted', '__proto__', undefined]) {
    assert.throws(() => resolveLibraryTestSchemaMode({ domain, env: {} }), TypeError);
  }
  assert.throws(() => resolveLibraryTestSchemaMode({ domain: 'tag_snapshot', env: null }), TypeError);
  assert.throws(() => resolveLibraryTestSchemaMode({ domain: 'tag_snapshot', env: {}, defaultMode: 'unknown' }), TypeError);
});
