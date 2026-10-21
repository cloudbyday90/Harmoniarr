import assert from 'node:assert/strict';
import test from 'node:test';
import { canEnterRoute, refreshRouteSession, requiresAdministratorRouteSession } from '../../src/client/lib/route-access-policy.js';

const reviewedRoutes = ['activity-users', 'activity-blocklist', 'activity-ignored', 'activity-history', 'settings-connections'];

test('composed admission requires exact admin across reviewed Activity and Settings routes', () => {
  for (const routeName of reviewedRoutes) {
    assert.equal(requiresAdministratorRouteSession(routeName), true);
    assert.equal(canEnterRoute({ routeName, actorRole: 'admin' }), true);
    for (const actorRole of ['operator', 'requester', 'ADMIN', true, undefined, null]) {
      assert.equal(canEnterRoute({ routeName, actorRole }), false);
    }
  }
});

test('Account aliases and other unreviewed destinations retain existing policies without verification reads', async () => {
  let reads = 0;
  for (const routeName of ['settings-account', 'account-security', 'settings', 'settings-media-storage', 'settings-general', 'dashboard', 'missing', 'activity-feed', undefined]) {
    assert.equal(requiresAdministratorRouteSession(routeName), false);
    for (const actorRole of ['operator', 'requester']) assert.equal(canEnterRoute({ routeName, actorRole }), true);
    assert.equal(await refreshRouteSession({ routeName, refreshSession: () => { reads++; } }), true);
  }
  assert.equal(reads, 0);
});

test('common verification holds admission and refuses Error/null failures for every reviewed route', async () => {
  for (const routeName of reviewedRoutes) {
    let release;
    let settled = false;
    const held = new Promise(resolve => { release = resolve; });
    const verified = refreshRouteSession({ routeName, refreshSession: () => held });
    verified.then(() => { settled = true; });
    await Promise.resolve();
    assert.equal(settled, false);
    release();
    assert.equal(await verified, true);
    for (const value of [new Error('private-session-error'), null]) {
      assert.equal(await refreshRouteSession({ routeName, refreshSession: async () => { throw value; } }), false);
    }
  }
});
