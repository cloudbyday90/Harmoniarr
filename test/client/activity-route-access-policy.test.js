import assert from 'node:assert/strict';
import test from 'node:test';
import { canEnterActivityRoute, refreshActivityRouteSession, requiresAdministratorActivitySession } from '../../src/client/lib/activity-route-access-policy.js';

const administratorRoutes = ['activity-users', 'activity-blocklist', 'activity-ignored', 'activity-history'];

test('reviewed Activity admission requires exact administrator role, including unknown-role denial', () => {
  for (const routeName of administratorRoutes) {
    assert.equal(requiresAdministratorActivitySession(routeName), true);
    assert.equal(canEnterActivityRoute({ routeName, actorRole: 'admin' }), true);
    for (const actorRole of ['operator', 'requester', 'ADMIN', true, undefined, null]) {
      assert.equal(canEnterActivityRoute({ routeName, actorRole }), false);
    }
  }
});
test('unreviewed routes retain existing policies without new session reads', async () => {
  let reads = 0;
  for (const routeName of ['dashboard', 'missing', 'missing-decision', 'activity-feed', 'activity-requests', 'activity-diagnostics-matches', 'settings-account', 'settings-connections', undefined]) {
    assert.equal(requiresAdministratorActivitySession(routeName), false);
    assert.equal(canEnterActivityRoute({ routeName, actorRole: 'operator' }), true);
    assert.equal(await refreshActivityRouteSession({ routeName, refreshSession: () => { reads++; } }), true);
  }
  assert.equal(reads, 0);
});
test('current-session verification holds admission and refuses failures without reflecting raw errors', async () => {
  for (const routeName of administratorRoutes) {
    let release;
    let settled = false;
    const held = new Promise(resolve => { release = resolve; });
    const verified = refreshActivityRouteSession({ routeName, refreshSession: () => held });
    verified.then(() => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false);
    release();
    assert.equal(await verified, true);
    for (const value of [new Error('private-session-error'), null]) {
      assert.equal(await refreshActivityRouteSession({ routeName, refreshSession: async () => { throw value; } }), false);
    }
  }
});
