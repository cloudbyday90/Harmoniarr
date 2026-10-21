import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSettingsNavigation, SETTINGS_PRIMARY_TABS, SETTINGS_SECONDARY_TABS } from '../../src/client/lib/settings-navigation.js';
import { canEnterSettingsRoute, requiresAdministratorSettingsSession, resolveSettingsRouteRedirect } from '../../src/client/lib/settings-route-access-policy.js';

test('Settings owns reviewed Setup/Connections admission and leaves Account available', () => {
  for (const routeName of ['settings', 'settings-connections']) {
    assert.equal(requiresAdministratorSettingsSession(routeName), true);
    assert.equal(canEnterSettingsRoute({ routeName, actorRole: 'admin' }), true);
  }
  for (const actorRole of ['operator', 'requester', undefined, null, 'ADMIN', true]) {
    for (const routeName of ['settings', 'settings-connections']) assert.equal(canEnterSettingsRoute({ routeName, actorRole }), false);
    for (const routeName of ['settings-account', 'account-security', 'settings-general', 'activity-history']) {
      assert.equal(requiresAdministratorSettingsSession(routeName), false);
      assert.equal(canEnterSettingsRoute({ routeName, actorRole }), true);
    }
  }
});

test('Settings projection filters Setup/Connections, preserves order/Account and cannot mutate its inventory', () => {
  const admin = { primary: SETTINGS_PRIMARY_TABS, secondary: SETTINGS_SECONDARY_TABS };
  assert.deepEqual(buildSettingsNavigation('admin'), admin);
  for (const actorRole of ['operator', 'requester', undefined, 'ADMIN']) {
    const result = buildSettingsNavigation(actorRole);
    assert.deepEqual(result.primary.map(tab => tab.name), ['settings-media-storage', 'settings-notifications', 'settings-library']);
    assert.deepEqual(result.secondary, SETTINGS_SECONDARY_TABS);
    assert.equal(result.secondary.some(tab => tab.name === 'settings-account'), true);
    result.primary.pop();
    assert.deepEqual(buildSettingsNavigation('admin'), admin);
  }
  for (const tabs of [SETTINGS_PRIMARY_TABS, SETTINGS_SECONDARY_TABS]) {
    assert.equal(Object.isFrozen(tabs), true);
    assert.equal(tabs.every(tab => Object.isFrozen(tab)), true);
  }
});

test('only refused Settings roots redirect to a fixed Account destination with replacement history', () => {
  for (const actorRole of ['operator', 'requester', undefined, null, true, 'ADMIN']) {
    assert.deepEqual(resolveSettingsRouteRedirect({ routeName: 'settings', actorRole, query: { redirect: '//other.test', role: 'admin' }, hash: '#setup' }), { name: 'settings-account', replace: true });
  }
  assert.equal(resolveSettingsRouteRedirect({ routeName: 'settings', actorRole: 'admin' }), null);
  for (const routeName of ['settings-connections', 'settings-account', 'account-security', 'settings-general', 'dashboard', undefined]) {
    assert.equal(resolveSettingsRouteRedirect({ routeName, actorRole: 'operator' }), null);
  }
});
