import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSettingsSectionHash,
  defaultSettingsSectionId,
  normalizeSettingsSectionId,
  settingsNavigationItems,
  settingsSectionNavigationItems,
} from '../../src/client/lib/settings-navigation.js';

test('settings section navigation keeps a stable section order for the workspace', () => {
  assert.deepEqual(
    settingsSectionNavigationItems.map((item) => item.id),
    ['general', 'connections', 'media-storage', 'users-access', 'library', 'notifications', 'library-browser', 'recovery'],
  );
});

test('normalizeSettingsSectionId falls back to the default section for unknown values', () => {
  assert.equal(normalizeSettingsSectionId('#connections'), 'connections');
  assert.equal(normalizeSettingsSectionId('users-access'), 'users-access');
  assert.equal(normalizeSettingsSectionId('#unknown'), defaultSettingsSectionId);
  assert.equal(normalizeSettingsSectionId(null), defaultSettingsSectionId);
});

test('buildSettingsSectionHash always returns a valid section hash', () => {
  assert.equal(buildSettingsSectionHash('media-storage'), '#media-storage');
  assert.equal(buildSettingsSectionHash('#missing'), `#${defaultSettingsSectionId}`);
});

test('settings navigation keeps account security as a separate route-level destination', () => {
  const accountItem = settingsNavigationItems.find((item) => item.id === 'account-security');

  assert.deepEqual(accountItem, {
    id: 'account-security',
    label: 'My account',
    description: 'Password changes, active sessions, and recent account activity.',
    routeName: 'account-security',
    type: 'route',
  });
});