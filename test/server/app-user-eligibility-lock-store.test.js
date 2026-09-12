/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { lockAppUserEligibility } from '../../src/server/app-user-eligibility-lock-store.js';

for (const [mode, clause] of [['read', 'FOR SHARE'], ['write', 'FOR NO KEY UPDATE']]) {
  test(`eligibility ${mode} guards use a shared parent table and database UUID ordering`, async () => {
    const calls = [];
    const userIds = ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'];

    await lockAppUserEligibility({
      userIds: [...userIds, userIds[0]],
      mode,
      queryable: { async query(...args) { calls.push(args); } },
    });

    assert.equal(calls.length, 1);
    assert.match(calls[0][0], /FROM app_users WHERE id = ANY\(\$1::uuid\[\]\) ORDER BY id/u);
    assert.ok(calls[0][0].endsWith(clause));
    assert.doesNotMatch(calls[0][0], /JOIN|plex_profiles/u);
    assert.deepEqual(calls[0][1], [userIds]);
  });
}

test('eligibility guards reject missing transaction clients and invalid lock modes', async () => {
  for (const options of [
    { userIds: ['user-1'] },
    { userIds: ['user-1'], queryable: {} },
    { userIds: ['user-1'], mode: 'FOR UPDATE', queryable: { query: async () => {} } },
  ]) {
    await assert.rejects(lockAppUserEligibility(options), /transaction client/u);
  }
});
