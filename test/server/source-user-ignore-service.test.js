/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceUserIgnoreService } from '../../src/server/activity/source-user-ignore-service.js';

function createStoreStub(t, overrides = {}) {
  return {
    getIgnoreEntry: t.mock.fn(async () => null),
    listIgnoreEntries: t.mock.fn(async () => []),
    listIgnoredUsernames: t.mock.fn(async () => ['bad-peer']),
    removeIgnoreEntry: t.mock.fn(async () => ({ removedCount: 1 })),
    touchAutoEvaluation: t.mock.fn(async () => true),
    upsertIgnoreEntry: t.mock.fn(async ({ username, source }) => ({ username, source, reason: null, usernameKey: username.toLowerCase() })),
    ...overrides,
  };
}

test('listIgnoredUsernamesForFilter degrades to an empty list on lookup failure', async (t) => {
  const ignoreStore = createStoreStub(t, {
    listIgnoredUsernames: t.mock.fn(async () => { throw new Error('db down'); }),
  });
  const service = createSourceUserIgnoreService({ ignoreStore, loadSettingsFn: async () => ({}), recordAuditEventFn: async () => {} });

  assert.deepEqual(await service.listIgnoredUsernamesForFilter(), []);
});

test('applyIgnoreSuggestion upserts a manual entry and records an audit event', async (t) => {
  const ignoreStore = createStoreStub(t);
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createSourceUserIgnoreService({ ignoreStore, loadSettingsFn: async () => ({}), recordAuditEventFn });

  await service.applyIgnoreSuggestion({ actorUserId: 'admin-1', reason: 'bad', username: 'Bad-Peer' });

  assert.equal(ignoreStore.upsertIgnoreEntry.mock.calls[0].arguments[0].source, 'manual');
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'source_user_ignored');
});

test('removeIgnoredUser deletes and audits only when a row was removed', async (t) => {
  const recordAuditEventFn = t.mock.fn(async () => {});
  const ignoreStore = createStoreStub(t, { removeIgnoreEntry: t.mock.fn(async () => ({ removedCount: 0 })) });
  const service = createSourceUserIgnoreService({ ignoreStore, loadSettingsFn: async () => ({}), recordAuditEventFn });

  await service.removeIgnoredUser({ username: 'unknown' });

  assert.equal(recordAuditEventFn.mock.calls.length, 0);
});

test('evaluateAutoIgnoreForUser does nothing when auto-apply is disabled', async (t) => {
  const ignoreStore = createStoreStub(t);
  const service = createSourceUserIgnoreService({
    ignoreStore,
    loadSettingsFn: async () => ({ acquisition: { autoIgnoreEnabled: false } }),
    recordAuditEventFn: async () => {},
  });

  const result = await service.evaluateAutoIgnoreForUser({
    suggestion: { suggested: true, reason: 'bad' },
    username: 'Bad-Peer',
  });

  assert.deepEqual(result, { applied: false, skipReason: 'auto_apply_disabled' });
  assert.equal(ignoreStore.upsertIgnoreEntry.mock.calls.length, 0);
});

test('evaluateAutoIgnoreForUser auto-applies a confident suggestion and audits as a system action', async (t) => {
  const ignoreStore = createStoreStub(t);
  const recordAuditEventFn = t.mock.fn(async () => {});
  const service = createSourceUserIgnoreService({
    ignoreStore,
    loadSettingsFn: async () => ({ acquisition: { autoIgnoreEnabled: true, autoIgnoreCooldownHours: 24 } }),
    recordAuditEventFn,
  });

  const result = await service.evaluateAutoIgnoreForUser({
    reputation: { decayedFailureRatio: 0.8, sampleSize: 6, wilsonUpperBound: 0.3 },
    suggestion: { suggested: true, reason: 'failure-dominated', signals: {} },
    username: 'Bad-Peer',
  });

  assert.deepEqual(result, { applied: true, skipReason: null });
  assert.equal(ignoreStore.upsertIgnoreEntry.mock.calls[0].arguments[0].source, 'auto_suggested');
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].eventType, 'source_user_auto_ignored');
  assert.equal(recordAuditEventFn.mock.calls[0].arguments[0].actorType, 'system');
});

test('evaluateAutoIgnoreForUser refreshes the cooldown clock for an already-ignored peer', async (t) => {
  const ignoreStore = createStoreStub(t, {
    getIgnoreEntry: t.mock.fn(async () => ({ username: 'Bad-Peer', lastAutoEvaluatedAt: null, updatedAt: '2020-01-01T00:00:00.000Z' })),
  });
  const service = createSourceUserIgnoreService({
    ignoreStore,
    loadSettingsFn: async () => ({ acquisition: { autoIgnoreEnabled: true, autoIgnoreCooldownHours: 24 } }),
    recordAuditEventFn: async () => {},
  });

  const result = await service.evaluateAutoIgnoreForUser({
    suggestion: { suggested: true, reason: 'bad' },
    username: 'Bad-Peer',
  });

  assert.equal(result.applied, false);
  assert.equal(result.skipReason, 'already_ignored');
  assert.equal(ignoreStore.touchAutoEvaluation.mock.calls.length, 1);
});

test('evaluateAutoIgnoreForUser never throws on a downstream failure', async (t) => {
  const ignoreStore = createStoreStub(t, {
    getIgnoreEntry: t.mock.fn(async () => { throw new Error('db down'); }),
  });
  const service = createSourceUserIgnoreService({
    ignoreStore,
    loadSettingsFn: async () => ({ acquisition: { autoIgnoreEnabled: true } }),
    recordAuditEventFn: async () => {},
  });

  const result = await service.evaluateAutoIgnoreForUser({
    suggestion: { suggested: true },
    username: 'Bad-Peer',
  });

  assert.equal(result.applied, false);
  assert.equal(result.skipReason, 'error');
});
