/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

function isHttpsUrl(value) {
  return typeof value === 'string' && /^https:\/\//i.test(value.trim());
}

/**
 * Builds a saved-settings summary. It intentionally does not claim that a
 * reverse proxy, certificate, or network boundary is live and reachable.
 *
 * @param {{ security?: object, system?: object }=} settings
 * @returns {{ message: string, statusLabel: string, tone: 'info'|'success'|'warning', checks: Array<{ label: string, statusLabel: string, tone: 'info'|'success'|'warning' }> }}
 */
export function buildSecurityConfigurationPosture(settings = {}) {
  const security = settings.security ?? {};
  const system = settings.system ?? {};
  const isRemoteHttps = isHttpsUrl(system.baseUrl);
  const secureCookies = Boolean(security.secureCookies);
  const enforceHttps = Boolean(security.enforceHttps);
  const csrfRequired = security.csrfProtectionMode === 'required';
  const hstsEnabled = Boolean(security.strictTransportSecurity);
  const remoteReady = isRemoteHttps && secureCookies && enforceHttps;

  const checks = [{
    label: 'HTTPS access',
    statusLabel: isRemoteHttps && enforceHttps ? 'Required' : 'Not required',
    tone: isRemoteHttps && enforceHttps ? 'success' : 'info',
  }, {
    label: 'Session cookies',
    statusLabel: secureCookies ? 'Secure only' : 'Local HTTP compatible',
    tone: secureCookies ? 'success' : 'info',
  }, {
    label: 'Cross-site request protection',
    statusLabel: csrfRequired ? 'Required' : 'Local default',
    tone: csrfRequired ? 'success' : 'info',
  }];

  if (!isRemoteHttps) {
    return {
      checks,
      message: 'Configured for local HTTP access. Keep Harmoniarr private to your network; configure HTTPS before remote exposure.',
      statusLabel: 'Local access configuration',
      tone: 'info',
    };
  }

  if (!remoteReady) {
    return {
      checks,
      message: 'The saved base URL uses HTTPS, but secure cookies or HTTPS enforcement still need configuration before remote use.',
      statusLabel: 'Remote access needs attention',
      tone: 'warning',
    };
  }

  return {
    checks: [...checks, {
      label: 'Browser HTTPS memory',
      statusLabel: hstsEnabled ? 'Enabled' : 'Optional',
      tone: hstsEnabled ? 'success' : 'info',
    }],
    message: 'HTTPS enforcement and secure session cookies are configured. Confirm reverse-proxy and certificate health separately.',
    statusLabel: 'HTTPS configuration ready',
    tone: 'success',
  };
}
