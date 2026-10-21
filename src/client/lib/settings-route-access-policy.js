/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

const administratorRoutes = new Set([
  'settings',
  'settings-connections',
  'settings-media-storage',
  'settings-library',
  'settings-general',
  'settings-users',
  'settings-user-detail',
  'settings-recovery',
]);

export function requiresAdministratorSettingsSession(routeName) {
  return administratorRoutes.has(routeName);
}

export function canEnterSettingsRoute({ routeName, actorRole } = {}) {
  // Metadata browsing already supports operators; its privileged commands keep
  // their independent server guards. Requester refusal is a product route rule.
  if (routeName === 'settings-library-browser') return actorRole === 'admin' || actorRole === 'operator';
  return !requiresAdministratorSettingsSession(routeName) || actorRole === 'admin';
}

export function resolveSettingsRouteRedirect({ routeName, actorRole } = {}) {
  if (routeName === 'settings' && !canEnterSettingsRoute({ routeName, actorRole })) {
    return { name: 'settings-account', replace: true };
  }
  return null;
}
