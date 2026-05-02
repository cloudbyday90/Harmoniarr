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

import {
  normalizeOutboundBaseUrl,
  resolveAllowedOutboundHosts,
  resolveAllowedOutboundHostSuffixes,
} from '../../outbound-url-policy.js';

export const defaultSlskdBaseUrl = 'http://slskd:5030';
export const defaultSlskdRequestTimeoutMs = 10000;

export function normalizeSlskdBaseUrl(value, {
  allowedHosts = resolveAllowedOutboundHosts(process.env.SLSKD_ALLOWED_HOSTS, {
    envName: 'SLSKD_ALLOWED_HOSTS',
  }),
  allowedHostSuffixes = resolveAllowedOutboundHostSuffixes(process.env.SLSKD_ALLOWED_HOST_SUFFIXES, {
    envName: 'SLSKD_ALLOWED_HOST_SUFFIXES',
  }),
  fieldName = 'slskd.baseUrl',
} = {}) {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }

  const candidate = value.trim();
  if (!candidate) {
    throw new Error(`${fieldName} is required`);
  }

  try {
    return normalizeOutboundBaseUrl(candidate, {
      allowHttp: true,
      allowedHosts,
      allowedHostSuffixes,
      allowHttps: true,
      allowLocalhost: true,
      allowPrivateHosts: true,
      defaultPathname: '/api/v0/',
      fieldName,
      protocolErrorCode: 'slskd_misconfigured',
      validationErrorCode: 'slskd_misconfigured',
    }).toString();
  } catch (error) {
    throw new Error(error?.message ?? `Invalid slskd base URL: ${candidate}`);
  }
}

export function normalizeSlskdRequestTimeoutMs(value, {
  fieldName = 'slskd.requestTimeoutMs',
  max = 120000,
  min = 1000,
} = {}) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${fieldName} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}

export function resolveSlskdBaseUrlDefault(env = process.env) {
  try {
    return normalizeSlskdBaseUrl(env.SLSKD_BASE_URL ?? defaultSlskdBaseUrl, {
      allowedHosts: resolveAllowedOutboundHosts(env.SLSKD_ALLOWED_HOSTS, {
        envName: 'SLSKD_ALLOWED_HOSTS',
      }),
      allowedHostSuffixes: resolveAllowedOutboundHostSuffixes(env.SLSKD_ALLOWED_HOST_SUFFIXES, {
        envName: 'SLSKD_ALLOWED_HOST_SUFFIXES',
      }),
    });
  } catch {
    return defaultSlskdBaseUrl;
  }
}

export function resolveSlskdRequestTimeoutDefault(env = process.env) {
  try {
    return normalizeSlskdRequestTimeoutMs(env.SLSKD_REQUEST_TIMEOUT_MS ?? defaultSlskdRequestTimeoutMs);
  } catch {
    return defaultSlskdRequestTimeoutMs;
  }
}

export function hasConfiguredSlskdApiKey(env = process.env) {
  return typeof env.SLSKD_API_KEY === 'string' && env.SLSKD_API_KEY.trim().length > 0;
}

export function buildSlskdRuntimeConfig({ apiKey = null, env = process.env, settings = {} } = {}) {
  const slskdSettings = settings.slskd ?? {};

  return {
    apiKey: apiKey ?? (hasConfiguredSlskdApiKey(env) ? env.SLSKD_API_KEY : undefined),
    baseUrl: slskdSettings.baseUrl || resolveSlskdBaseUrlDefault(env),
    requestTimeoutMs: slskdSettings.requestTimeoutMs ?? resolveSlskdRequestTimeoutDefault(env),
  };
}