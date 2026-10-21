import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSettingsNavigation, SETTINGS_PRIMARY_TABS, SETTINGS_SECONDARY_TABS } from '../../src/client/lib/settings-navigation.js';
import { canEnterSettingsRoute, requiresAdministratorSettingsSession } from '../../src/client/lib/settings-route-access-policy.js';

test('Settings owns only reviewed Connections admission and leaves Account available', () => {
  assert.equal(requiresAdministratorSettingsSession('settings-connections'), true);
  assert.equal(canEnterSettingsRoute({ routeName: 'settings-connections', actorRole: 'admin' }), true);
  for (const actorRole of ['operator', 'requester', undefined, null, 'ADMIN', true]) {
    assert.equal(canEnterSettingsRoute({ routeName: 'settings-connections', actorRole }), false);
    for (const routeName of ['settings-account', 'account-security', 'settings', 'settings-general', 'activity-history']) {
      assert.equal(requiresAdministratorSettingsSession(routeName), false);
      assert.equal(canEnterSettingsRoute({ routeName, actorRole }), true);
    }
  }
});

test('Settings projection filters only Connections, preserves order/Account and cannot mutate its inventory', () => {
  const admin = { primary: SETTINGS_PRIMARY_TABS, secondary: SETTINGS_SECONDARY_TABS };
  assert.deepEqual(buildSettingsNavigation('admin'), admin);
  for (const actorRole of ['operator', 'requester', undefined, 'ADMIN']) {
    const result = buildSettingsNavigation(actorRole);
    assert.deepEqual(result.primary, SETTINGS_PRIMARY_TABS.filter(tab => tab.name !== 'settings-connections'));
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
