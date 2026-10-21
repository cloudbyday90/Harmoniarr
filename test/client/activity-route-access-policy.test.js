import assert from 'node:assert/strict';
import test from 'node:test';
import { canEnterActivityRoute, refreshActivityRouteSession, requiresAdministratorActivitySession } from '../../src/client/lib/activity-route-access-policy.js';

test('ignored-source admission requires exact administrator role, including unknown-role denial', () => {
  assert.equal(requiresAdministratorActivitySession('activity-ignored'), true);
  assert.equal(canEnterActivityRoute({ routeName: 'activity-ignored', actorRole: 'admin' }), true);
  for (const actorRole of ['operator', 'requester', 'ADMIN', true, undefined, null]) {
    assert.equal(canEnterActivityRoute({ routeName: 'activity-ignored', actorRole }), false);
  }
});
test('unreviewed routes retain existing policies without new session reads', async () => {
  let reads = 0;
  for (const routeName of ['dashboard', 'missing', 'missing-decision', 'activity-requests', 'activity-diagnostics-matches', 'settings-account']) {
    assert.equal(requiresAdministratorActivitySession(routeName), false);
    assert.equal(canEnterActivityRoute({ routeName, actorRole: 'operator' }), true);
    assert.equal(await refreshActivityRouteSession({ routeName, refreshSession: () => { reads++; } }), true);
  }
  assert.equal(reads, 0);
});
test('current-session verification holds admission and refuses failures without reflecting raw errors', async () => {
  let release; let settled = false;
  const held = new Promise(resolve => { release = resolve; });
  const verified = refreshActivityRouteSession({ routeName: 'activity-ignored', refreshSession: () => held });
  verified.then(() => { settled = true; }); await Promise.resolve(); assert.equal(settled, false);
  release(); assert.equal(await verified, true);
  for (const value of [new Error('private-session-error'), null]) {
    assert.equal(await refreshActivityRouteSession({ routeName: 'activity-ignored', refreshSession: async () => { throw value; } }), false);
  }
});
