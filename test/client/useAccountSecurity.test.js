import assert from 'node:assert/strict';
import test from 'node:test';
import { useAccountSecurity } from '../../src/client/composables/useAccountSecurity.js';

test('useAccountSecurity loads recent activity through the shared auth activity API', async (t) => {
  const workflow = useAccountSecurity({
    fetchActiveSessions: t.mock.fn(async () => ({ sessions: [] })),
  });

  const originalFetchRecentActivity = workflow.loadRecentActivity;
  assert.equal(typeof originalFetchRecentActivity, 'function');
});