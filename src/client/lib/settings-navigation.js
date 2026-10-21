/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { canEnterSettingsRoute } from './settings-route-access-policy.js';

const defineTabs = tabs => Object.freeze(tabs.map(tab => Object.freeze(tab)));

export const SETTINGS_PRIMARY_TABS = defineTabs([
  { name: 'settings', label: 'Setup' },
  { name: 'settings-connections', label: 'Connections' },
  { name: 'settings-media-storage', label: 'Media & storage' },
  { name: 'settings-notifications', label: 'Notifications' },
  { name: 'settings-library', label: 'Library' },
]);

export const SETTINGS_SECONDARY_TABS = defineTabs([
  { name: 'settings-general', label: 'System & security' },
  { name: 'settings-users', label: 'Users & access' },
  { name: 'settings-account', label: 'Account' },
  { name: 'settings-recovery', label: 'Backup & restore' },
  { name: 'settings-library-browser', label: 'Metadata browser' },
]);

export function buildSettingsNavigation(actorRole) {
  const visible = tab => canEnterSettingsRoute({ routeName: tab.name, actorRole });
  return { primary: SETTINGS_PRIMARY_TABS.filter(visible), secondary: SETTINGS_SECONDARY_TABS.filter(visible) };
}
