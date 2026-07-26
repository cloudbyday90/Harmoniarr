/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

export const slskdProviderModes = Object.freeze([
  'managed',
  'external',
  'disabled',
]);

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function hasManagedSlskdDeployment(env = process.env) {
  return hasNonEmptyString(env.SLSKD_API_KEY_FILE);
}

export function resolveSlskdProviderModeDefault(env = process.env) {
  return hasManagedSlskdDeployment(env) ? 'managed' : 'external';
}

export function normalizeSlskdProviderMode(value, {
  fallback = resolveSlskdProviderModeDefault(),
} = {}) {
  const candidate = value == null || value === '' ? fallback : String(value).trim().toLowerCase();
  if (!slskdProviderModes.includes(candidate)) {
    throw new Error('slskd.providerMode must be one of managed, external, disabled');
  }

  return candidate;
}

export function resolveSlskdProviderMode({
  env = process.env,
  providerMode,
} = {}) {
  const requestedMode = normalizeSlskdProviderMode(providerMode, {
    fallback: resolveSlskdProviderModeDefault(env),
  });
  const managedDeploymentDetected = hasManagedSlskdDeployment(env);

  if (requestedMode === 'disabled') {
    return {
      managedDeploymentDetected,
      mode: 'disabled',
      modeLocked: false,
      requestedMode,
      state: 'disabled',
    };
  }

  if (managedDeploymentDetected) {
    return {
      managedDeploymentDetected: true,
      mode: 'managed',
      modeLocked: true,
      requestedMode,
      state: 'ready',
    };
  }

  if (requestedMode === 'managed') {
    return {
      managedDeploymentDetected: false,
      mode: 'managed',
      modeLocked: false,
      requestedMode,
      state: 'managed_deployment_missing',
    };
  }

  return {
    managedDeploymentDetected: false,
    mode: 'external',
    modeLocked: false,
    requestedMode,
    state: 'ready',
  };
}
