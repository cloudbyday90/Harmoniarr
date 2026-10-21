/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

// Only these reviewed Activity boundaries are restricted here. Existing session,
// requester and other destination policies remain independently enforced.
const administratorRoutes = new Set(['activity-users', 'activity-blocklist', 'activity-ignored', 'activity-history']);

export function requiresAdministratorActivitySession(routeName) {
  return administratorRoutes.has(routeName);
}

export function canEnterActivityRoute({ routeName, actorRole } = {}) {
  return !requiresAdministratorActivitySession(routeName) || actorRole === 'admin';
}

export async function refreshActivityRouteSession({ routeName, refreshSession } = {}) {
  if (!requiresAdministratorActivitySession(routeName)) return true;
  try {
    await refreshSession();
    return true;
  } catch {
    return false;
  }
}
