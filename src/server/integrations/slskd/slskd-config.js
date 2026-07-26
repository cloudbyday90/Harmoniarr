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

import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import {
  normalizeOutboundBaseUrl,
  resolveAllowedOutboundHosts,
  resolveAllowedOutboundHostSuffixes,
} from '../../outbound-url-policy.js';
import { resolveSlskdProviderMode } from './slskd-provider-mode.js';

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
    throw new Error(error?.message ?? `Invalid slskd base URL: ${candidate}`, { cause: error });
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

function normalizeSlskdApiKey(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function resolveSlskdEnvironmentApiKey(env = process.env, {
  readFileSyncFn = readFileSync,
} = {}) {
  const apiKeyFile = typeof env.SLSKD_API_KEY_FILE === 'string' ? env.SLSKD_API_KEY_FILE.trim() : '';
  if (apiKeyFile) {
    if (!isAbsolute(apiKeyFile)) {
      throw new Error('SLSKD_API_KEY_FILE must be an absolute path');
    }

    const fileApiKey = normalizeSlskdApiKey(readFileSyncFn(apiKeyFile, 'utf8'));
    if (!fileApiKey) {
      throw new Error('SLSKD_API_KEY_FILE must contain a non-empty API key');
    }

    return {
      source: 'managed_file',
      value: fileApiKey,
    };
  }

  const directApiKey = normalizeSlskdApiKey(env.SLSKD_API_KEY);
  if (!directApiKey) {
    return null;
  }

  return {
    source: 'environment',
    value: directApiKey,
  };
}

export function hasConfiguredSlskdApiKey(env = process.env, options = {}) {
  try {
    return resolveSlskdEnvironmentApiKey(env, options) !== null;
  } catch {
    return false;
  }
}

export function buildSlskdRuntimeConfig({ apiKey = null, env = process.env, settings = {} } = {}) {
  const slskdSettings = settings.slskd ?? {};
  const providerMode = resolveSlskdProviderMode({
    env,
    providerMode: slskdSettings.providerMode,
  });

  if (providerMode.state === 'disabled') {
    return {
      enabled: false,
      providerMode,
      providerModeError: {
        code: 'slskd_disabled',
        message: 'Soulseek downloads are turned off in Settings.',
      },
    };
  }

  if (providerMode.state === 'managed_deployment_missing') {
    return {
      enabled: false,
      providerMode,
      providerModeError: {
        code: 'slskd_managed_deployment_missing',
        message: 'Managed Soulseek requires the Harmoniarr managed Docker overlay.',
      },
    };
  }

  const environmentApiKey = resolveSlskdEnvironmentApiKey(env);

  return {
    apiKey: apiKey ?? environmentApiKey?.value ?? undefined,
    baseUrl: slskdSettings.baseUrl || resolveSlskdBaseUrlDefault(env),
    enabled: true,
    providerMode,
    requestTimeoutMs: slskdSettings.requestTimeoutMs ?? resolveSlskdRequestTimeoutDefault(env),
  };
}
