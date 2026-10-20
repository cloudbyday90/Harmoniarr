/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createHash, createHmac } from 'node:crypto';
import { createApiError } from '../auth.js';
import { slskdEndpointFingerprint } from './slskd-download-protocol-policy.js';

export const searchFingerprintPattern = /^[0-9a-f]{64}$/u;
export const searchUuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export function slskdSearchProviderFingerprint(config = {}) {
  const key = config.apiKey === undefined ? process.env.SLSKD_API_KEY ?? '' : config.apiKey ?? '';
  return createHmac('sha256', key).update('harmoniarr-search-provider-v1\0')
    .update(slskdEndpointFingerprint(config)).digest('hex');
}

export function assertSlskdSearchBinding({ config, searchBinding }) {
  if (config?.enabled === false || !searchFingerprintPattern.test(searchBinding ?? '')
    || slskdSearchProviderFingerprint(config) !== searchBinding) {
    throw createApiError(409, 'slskd_search_provider_changed', 'The search connection changed. Review the search before continuing.');
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).filter(key => value[key] !== undefined).sort().map(key => [key, canonical(value[key])]));
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
  throw new TypeError('Search intent context must contain JSON values');
}

export function slskdSearchIntentFingerprint({ query, context }) {
  const value = JSON.stringify(canonical({ version: 1, query, context }));
  if (Buffer.byteLength(value) > 65536) throw new TypeError('Search intent context exceeds its limit');
  return createHash('sha256').update(value).digest('hex');
}
