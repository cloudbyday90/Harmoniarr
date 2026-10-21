import assert from 'node:assert/strict';
import test from 'node:test';
import { canEnterActivityRoute, requiresAdministratorActivitySession } from '../../src/client/lib/activity-route-access-policy.js';

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
test('Activity policy leaves other destinations to their owning policies', () => {
  for (const routeName of ['dashboard', 'missing', 'missing-decision', 'activity-feed', 'activity-requests', 'activity-diagnostics-matches', 'settings-account', 'settings-connections', undefined]) {
    assert.equal(requiresAdministratorActivitySession(routeName), false);
    assert.equal(canEnterActivityRoute({ routeName, actorRole: 'operator' }), true);
  }
});
