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

import { isIP } from 'node:net';

function createOutboundUrlError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeExactHostEntry(value, { fieldName }) {
  if (typeof value !== 'string') {
    throw createOutboundUrlError('integration_misconfigured', `${fieldName} entries must be strings`);
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    throw createOutboundUrlError('integration_misconfigured', `${fieldName} entries must not be empty`);
  }

  if (trimmed.includes('/') || trimmed.includes('?') || trimmed.includes('#') || trimmed.includes('@')) {
    throw createOutboundUrlError('integration_misconfigured', `${fieldName} entries must be bare hostnames or IP addresses`);
  }

  if (trimmed.startsWith('*.') || trimmed.startsWith('.')) {
    throw createOutboundUrlError('integration_misconfigured', `${fieldName} does not support wildcard entries`);
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const unwrappedIpv6 = trimmed.slice(1, -1);
    if (isIP(unwrappedIpv6) !== 6) {
      throw createOutboundUrlError('integration_misconfigured', `${fieldName} contains an invalid IPv6 address: ${value}`);
    }

    return unwrappedIpv6;
  }

  if (trimmed.includes(':') && isIP(trimmed) !== 6) {
    throw createOutboundUrlError('integration_misconfigured', `${fieldName} entries must not include ports`);
  }

  if (classifyHostname(trimmed) === 'invalid') {
    throw createOutboundUrlError('integration_misconfigured', `${fieldName} contains an invalid host entry: ${value}`);
  }

  return trimmed;
}

function normalizeHostSuffixEntry(value, { fieldName }) {
  if (typeof value !== 'string') {
    throw createOutboundUrlError('integration_misconfigured', `${fieldName} entries must be strings`);
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    throw createOutboundUrlError('integration_misconfigured', `${fieldName} entries must not be empty`);
  }

  if (trimmed.includes('/') || trimmed.includes('?') || trimmed.includes('#') || trimmed.includes('@') || trimmed.includes(':')) {
    throw createOutboundUrlError('integration_misconfigured', `${fieldName} entries must be bare domain suffixes`);
  }

  const normalized = trimmed.startsWith('*.')
    ? trimmed.slice(2)
    : trimmed.startsWith('.')
      ? trimmed.slice(1)
      : trimmed;

  if (classifyHostname(normalized) !== 'hostname') {
    throw createOutboundUrlError('integration_misconfigured', `${fieldName} contains an invalid domain suffix: ${value}`);
  }

  return normalized;
}

function normalizeConfiguredEntries(values, { fieldName, normalizeEntry }) {
  if (values == null) {
    return [];
  }

  const rawValues = Array.isArray(values)
    ? values
    : values instanceof Set
      ? Array.from(values)
      : [values];

  const normalizedValues = rawValues.map((value) => normalizeEntry(value, { fieldName }));
  return Array.from(new Set(normalizedValues));
}

function isHostnameAllowed(hostname, { allowedHosts, allowedHostSuffixes }) {
  const normalizedHostname = hostname.trim().toLowerCase();

  if (allowedHosts.includes(normalizedHostname)) {
    return true;
  }

  return allowedHostSuffixes.some((suffix) => normalizedHostname === suffix || normalizedHostname.endsWith(`.${suffix}`));
}

function parseDelimitedHostEntries(value, { envName, normalizeEntry }) {
  if (value == null || value === '') {
    return [];
  }

  const entries = String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  return normalizeConfiguredEntries(entries, {
    fieldName: envName,
    normalizeEntry,
  });
}

function classifyIpv4(hostname) {
  const octets = hostname.split('.').map((value) => Number.parseInt(value, 10));
  const [first, second] = octets;

  if (first === 127 || first === 0) {
    return 'localhost';
  }

  if (first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168) || (first === 169 && second === 254)) {
    return 'private';
  }

  return 'public';
}

function classifyIpv6(hostname) {
  const normalized = hostname.toLowerCase();
  if (normalized === '::1' || normalized === '::') {
    return 'localhost';
  }

  if (
    normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe8')
    || normalized.startsWith('fe9')
    || normalized.startsWith('fea')
    || normalized.startsWith('feb')
  ) {
    return 'private';
  }

  return 'public';
}

function classifyHostname(hostname) {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return 'invalid';
  }

  if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
    return 'localhost';
  }

  const ipVersion = isIP(normalized);
  if (ipVersion === 4) {
    return classifyIpv4(normalized);
  }

  if (ipVersion === 6) {
    return classifyIpv6(normalized);
  }

  return 'hostname';
}

export function resolveAllowedOutboundHosts(value, {
  envName = 'HARMONIARR_ALLOWED_OUTBOUND_HOSTS',
} = {}) {
  return parseDelimitedHostEntries(value, {
    envName,
    normalizeEntry: normalizeExactHostEntry,
  });
}

export function resolveAllowedOutboundHostSuffixes(value, {
  envName = 'HARMONIARR_ALLOWED_OUTBOUND_HOST_SUFFIXES',
} = {}) {
  return parseDelimitedHostEntries(value, {
    envName,
    normalizeEntry: normalizeHostSuffixEntry,
  });
}

export function normalizeOutboundBaseUrl(value, {
  allowHash = false,
  allowHttp = false,
  allowedHosts = null,
  allowedHostSuffixes = null,
  allowHttps = true,
  allowLocalhost = false,
  allowPrivateHosts = false,
  allowQuery = false,
  defaultPathname = '/',
  fieldName = 'baseUrl',
  protocolErrorCode = 'integration_misconfigured',
  validationErrorCode = 'integration_misconfigured',
} = {}) {
  if (typeof value !== 'string') {
    throw createOutboundUrlError(validationErrorCode, `${fieldName} must be a string`);
  }

  const candidate = value.trim();
  if (!candidate) {
    throw createOutboundUrlError(validationErrorCode, `${fieldName} is required`);
  }

  let normalized;
  try {
    normalized = new URL(candidate);
  } catch {
    throw createOutboundUrlError(validationErrorCode, `Invalid ${fieldName}: ${candidate}`);
  }

  const allowedProtocols = [
    ...(allowHttp ? ['http:'] : []),
    ...(allowHttps ? ['https:'] : []),
  ];
  if (!allowedProtocols.includes(normalized.protocol)) {
    throw createOutboundUrlError(protocolErrorCode, `${fieldName} must use ${allowedProtocols.join(' or ')}`);
  }

  if (normalized.username || normalized.password) {
    throw createOutboundUrlError(validationErrorCode, `${fieldName} must not include embedded credentials`);
  }

  if (!allowQuery && normalized.search) {
    throw createOutboundUrlError(validationErrorCode, `${fieldName} must not include a query string`);
  }

  if (!allowHash && normalized.hash) {
    throw createOutboundUrlError(validationErrorCode, `${fieldName} must not include a URL fragment`);
  }

  const hostClassification = classifyHostname(normalized.hostname);
  if (hostClassification === 'invalid') {
    throw createOutboundUrlError(validationErrorCode, `${fieldName} must include a valid host`);
  }

  if (hostClassification === 'localhost' && !allowLocalhost) {
    throw createOutboundUrlError(validationErrorCode, `${fieldName} must not target localhost`);
  }

  if (hostClassification === 'private' && !allowPrivateHosts) {
    throw createOutboundUrlError(validationErrorCode, `${fieldName} must not target private network addresses`);
  }

  const normalizedAllowedHosts = normalizeConfiguredEntries(allowedHosts, {
    fieldName: `${fieldName} allowedHosts`,
    normalizeEntry: normalizeExactHostEntry,
  });
  const normalizedAllowedHostSuffixes = normalizeConfiguredEntries(allowedHostSuffixes, {
    fieldName: `${fieldName} allowedHostSuffixes`,
    normalizeEntry: normalizeHostSuffixEntry,
  });

  if (
    (normalizedAllowedHosts.length > 0 || normalizedAllowedHostSuffixes.length > 0)
    && !isHostnameAllowed(normalized.hostname, {
      allowedHosts: normalizedAllowedHosts,
      allowedHostSuffixes: normalizedAllowedHostSuffixes,
    })
  ) {
    throw createOutboundUrlError(validationErrorCode, `${fieldName} must target an explicitly allowed host`);
  }

  const pathname = normalized.pathname.endsWith('/')
    ? normalized.pathname
    : `${normalized.pathname}/`;
  normalized.pathname = pathname === '/'
    ? defaultPathname
    : pathname;

  return normalized;
}