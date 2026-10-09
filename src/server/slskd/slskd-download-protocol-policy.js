/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createHash } from 'node:crypto';
import { createApiError } from '../auth.js';
import { defaultSlskdBaseUrl, normalizeSlskdBaseUrl } from '../integrations/slskd/slskd-config.js';

const protocols = new Map([['0.25.1', 'legacy'], ['0.26.0', 'batch']]);
const fingerprintPattern = /^[0-9a-f]{64}$/u;

export function selectSlskdDownloadProtocol(version) {
  const protocol = typeof version === 'string' ? protocols.get(version) : null;
  if (!protocol) throw createApiError(503, 'slskd_download_version_unsupported', 'The configured Downloader version has no verified download protocol');
  return protocol;
}

export function slskdEndpointFingerprint(config = {}) {
  const baseUrl = normalizeSlskdBaseUrl(config.baseUrl ?? process.env.SLSKD_BASE_URL ?? defaultSlskdBaseUrl, {
    ...(config.allowedHosts ? { allowedHosts: config.allowedHosts } : {}),
    ...(config.allowedHostSuffixes ? { allowedHostSuffixes: config.allowedHostSuffixes } : {}),
  });
  return createHash('sha256').update(JSON.stringify({ baseUrl, mode: config.providerMode ?? 'external' })).digest('hex');
}

export function createSlskdProviderBinding({ config = {}, version } = {}) {
  return { protocol: selectSlskdDownloadProtocol(version), version, endpointFingerprint: slskdEndpointFingerprint(config) };
}

export function validateSlskdProviderBinding(binding) {
  return Boolean(binding && typeof binding.version === 'string'
    && ['legacy', 'batch'].includes(binding.protocol) && protocols.get(binding.version) === binding.protocol
    && fingerprintPattern.test(binding.endpointFingerprint ?? ''));
}

export function assertSlskdProviderBindingCurrent({ binding, config = {} } = {}) {
  if (config.enabled === false || !validateSlskdProviderBinding(binding)
    || slskdEndpointFingerprint(config) !== binding.endpointFingerprint) {
    throw createApiError(503, 'slskd_download_provider_changed', 'The Downloader connection changed; this request remains in review');
  }
}
