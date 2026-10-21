/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { canEnterActivityRoute, requiresAdministratorActivitySession } from './activity-route-access-policy.js';
import { canEnterSettingsRoute, requiresAdministratorSettingsSession } from './settings-route-access-policy.js';

export function requiresAdministratorRouteSession(routeName) {
  return requiresAdministratorActivitySession(routeName) || requiresAdministratorSettingsSession(routeName);
}

export function canEnterRoute(options = {}) {
  return canEnterActivityRoute(options) && canEnterSettingsRoute(options);
}

export async function refreshRouteSession({ routeName, refreshSession } = {}) {
  if (!requiresAdministratorRouteSession(routeName)) return true;
  try {
    await refreshSession();
    return true;
  } catch {
    return false;
  }
}
