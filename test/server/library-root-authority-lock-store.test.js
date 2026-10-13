/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { lockLibraryRootAuthority } from '../../src/server/library/library-root-authority-lock-store.js';
import { createLibraryWantedReleaseGuardStore } from '../../src/server/library/library-wanted-release-guard-store.js';

test('direct Wanted admission checks the owned transaction before acquiring projection authority', async () => {
  const calls = []; const queryable = { query: async (...args) => { calls.push(args); return { rows: [] }; } };
  await createLibraryWantedReleaseGuardStore().lockContext({ prepared: { mode: 'direct' }, queryable });
  assert.deepEqual(calls, [['LOCK TABLE app_users, app_settings IN ACCESS SHARE MODE'],
    ['SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['harmoniarr.library-request-projection']]]);
});

test('transaction refusal retains original Error/null and never attempts authority admission', async () => {
  for (const primary of [new Error('refused transaction'), null]) {
    let calls = 0;
    await assert.rejects(lockLibraryRootAuthority({ queryable: { query: async () => { calls++; throw primary; } } }), error => error === primary);
    assert.equal(calls, 1);
  }
  await assert.rejects(lockLibraryRootAuthority({ queryable: {} }), TypeError);
});
