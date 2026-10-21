/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

// Other Settings destinations retain their independently enforced policies.
export function requiresAdministratorSettingsSession(routeName) {
  return routeName === 'settings' || routeName === 'settings-connections';
}

export function canEnterSettingsRoute({ routeName, actorRole } = {}) {
  return !requiresAdministratorSettingsSession(routeName) || actorRole === 'admin';
}

export function resolveSettingsRouteRedirect({ routeName, actorRole } = {}) {
  if (routeName === 'settings' && !canEnterSettingsRoute({ routeName, actorRole })) {
    return { name: 'settings-account', replace: true };
  }
  return null;
}
