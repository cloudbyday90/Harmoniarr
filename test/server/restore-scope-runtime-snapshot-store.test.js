import assert from 'node:assert/strict';
import test from 'node:test';
import { createRestoreScopeRuntimeSnapshotStore } from '../../src/server/recovery/restore-scope-runtime-snapshot-store.js';

function createQueryable() {
  const state = {
    overrides: [],
    trust: [],
  };

  function createQueryHandler() {
    return async (sql, params = []) => {
      if (/SELECT\s+payload\s+FROM\s+recovery_trust_snapshots/i.test(sql)) {
        return {
          rows: state.trust.map((payload) => ({ payload })),
        };
      }

      if (/SELECT\s+payload\s+FROM\s+recovery_override_snapshots/i.test(sql)) {
        return {
          rows: state.overrides.map((payload) => ({ payload })),
        };
      }

      if (/DELETE FROM recovery_trust_snapshots/i.test(sql)) {
        state.trust = [];
        return { rows: [] };
      }

      if (/DELETE FROM recovery_override_snapshots/i.test(sql)) {
        state.overrides = [];
        return { rows: [] };
      }

      if (/INSERT INTO recovery_trust_snapshots/i.test(sql)) {
        state.trust.push(JSON.parse(params[1]));
        return { rows: [] };
      }

      if (/INSERT INTO recovery_override_snapshots/i.test(sql)) {
        state.overrides.push(JSON.parse(params[1]));
        return { rows: [] };
      }

      if (/BEGIN|COMMIT|ROLLBACK/i.test(sql)) {
        return { rows: [] };
      }

      throw new Error('Unexpected query in test double');
    };
  }

  const query = createQueryHandler();

  return {
    query,
    async connect() {
      return {
        query,
        release() {},
      };
    },
  };
}

test('restore scope runtime snapshot store persists and returns trust snapshots', async () => {
  const pool = createQueryable();
  const store = createRestoreScopeRuntimeSnapshotStore({ getPoolFn: () => pool });

  assert.deepEqual(await store.listTrustSnapshot(), []);

  await store.replaceTrustSnapshot({
    sourceUsers: [
      {
        username: 'trusted-uploader',
        trustState: 'trusted',
      },
    ],
  });

  assert.deepEqual(await store.listTrustSnapshot(), [
    {
      username: 'trusted-uploader',
      trustState: 'trusted',
    },
  ]);
});

test('restore scope runtime snapshot store persists and returns overrides snapshots', async () => {
  const pool = createQueryable();
  const store = createRestoreScopeRuntimeSnapshotStore({ getPoolFn: () => pool });

  assert.deepEqual(await store.listOverridesSnapshot(), []);

  await store.replaceOverridesSnapshot({
    manualOverrides: [
      {
        scope: 'release',
        targetId: 'release-1',
        decision: 'prefer',
      },
    ],
  });

  assert.deepEqual(await store.listOverridesSnapshot(), [
    {
      scope: 'release',
      targetId: 'release-1',
      decision: 'prefer',
    },
  ]);
});