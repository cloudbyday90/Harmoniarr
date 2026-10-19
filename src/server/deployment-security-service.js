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

export const csrfProtectionModeEnvVar = 'HARMONIARR_CSRF_PROTECTION';
export const secureCookiesEnvVar = 'HARMONIARR_SECURE_COOKIES';
export const strictTransportSecurityEnvVar = 'HARMONIARR_ENABLE_STRICT_TRANSPORT_SECURITY';
export const enforceHttpsEnvVar = 'HARMONIARR_ENFORCE_HTTPS';

export const csrfProtectionModes = Object.freeze({
  disabled: 'disabled',
  required: 'required',
});

function parseBoolean(value, fallback = false, fieldName = 'boolean setting') {
  if (value == null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on', 'enabled'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off', 'disabled'].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid ${fieldName} value: ${value}`);
}

export function resolveCsrfProtectionMode(value = process.env[csrfProtectionModeEnvVar]) {
  const normalized = value == null ? '' : typeof value === 'string' ? value.trim().toLowerCase() : null;
  if (normalized === '') {
    return csrfProtectionModes.required;
  }

  if (normalized === csrfProtectionModes.required || normalized === csrfProtectionModes.disabled) {
    return normalized;
  }

  throw new Error(
    `Invalid ${csrfProtectionModeEnvVar} value: ${typeof value === 'string' ? value : typeof value}. Expected "${csrfProtectionModes.required}" or "${csrfProtectionModes.disabled}".`,
  );
}

export function resolveSecureCookiesEnabled(value = process.env[secureCookiesEnvVar]) {
  return parseBoolean(value, false, secureCookiesEnvVar);
}

export function resolveStrictTransportSecurityEnabled(value = process.env[strictTransportSecurityEnvVar]) {
  return parseBoolean(value, false, strictTransportSecurityEnvVar);
}

export function resolveHttpsEnforcementEnabled(value = process.env[enforceHttpsEnvVar]) {
  return parseBoolean(value, false, enforceHttpsEnvVar);
}

export function resolveDeploymentSecurityPolicy({ env = process.env, settings = {} } = {}) {
  const securitySettings = settings.security ?? {};

  return {
    csrfProtectionMode: resolveCsrfProtectionMode(
      securitySettings.csrfProtectionMode ?? env[csrfProtectionModeEnvVar] ?? null,
    ),
    enforceHttps: resolveHttpsEnforcementEnabled(
      securitySettings.enforceHttps ?? env[enforceHttpsEnvVar],
    ),
    secureCookies: resolveSecureCookiesEnabled(
      securitySettings.secureCookies ?? env[secureCookiesEnvVar],
    ),
    strictTransportSecurity: resolveStrictTransportSecurityEnabled(
      securitySettings.strictTransportSecurity ?? env[strictTransportSecurityEnvVar],
    ),
  };
}

export function createDeploymentSecurityService({
  env = process.env,
  loadSettingsFn = async () => ({}),
} = {}) {
  let cachedPolicy = resolveDeploymentSecurityPolicy({ env });
  let loadPromise = null;

  async function getPolicy() {
    if (loadPromise) {
      return loadPromise;
    }

    loadPromise = Promise.resolve(loadSettingsFn())
      .then((settings) => {
        cachedPolicy = resolveDeploymentSecurityPolicy({ env, settings });
        return cachedPolicy;
      })
      .catch(() => cachedPolicy);

    return loadPromise;
  }

  function getCachedPolicy() {
    return cachedPolicy;
  }

  function applySettings(settings) {
    cachedPolicy = resolveDeploymentSecurityPolicy({ env, settings });
    loadPromise = Promise.resolve(cachedPolicy);
    return cachedPolicy;
  }

  return {
    applySettings,
    getCachedPolicy,
    getPolicy,
  };
}