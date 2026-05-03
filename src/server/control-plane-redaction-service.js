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

const redactedValue = '[REDACTED]';
const redactedEmail = '[REDACTED_EMAIL]';
const redactedPath = '[REDACTED_PATH]';
const redactedBearer = 'Bearer [REDACTED]';

const sensitiveKeys = new Set([
  'accesstoken',
  'apikey',
  'authorization',
  'clientsecret',
  'confirmpassword',
  'connectionstring',
  'cookie',
  'csrftoken',
  'csrftokenhash',
  'databaseurl',
  'encryptionkey',
  'password',
  'passwordhash',
  'privatekey',
  'recoverycode',
  'recoverycodehash',
  'refreshtoken',
  'sessionid',
  'setcookie',
  'secret',
  'token',
]);

const pathKeys = new Set([
  'absolutepath',
  'destinationpath',
  'downloadroot',
  'downloadsroot',
  'libraryroot',
  'libraryrootpath',
  'mirroredpath',
  'resolvedpath',
  'rootpath',
  'sourcepath',
  'stagingpath',
  'storagepath',
  'targetpath',
]);

const windowsPathPattern = /\b[A-Za-z]:\\(?:[^\\\r\n\t ]+\\?)+/g;
const unixPathPattern = /\/(?:app|Users|home|mnt|srv|tmp|var|Volumes|backups?|data|downloads?|library|staging)(?:\/[^\s,)]+)+/g;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const bearerPattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi;
const sensitiveParameterNames = [
  'access_token',
  'api_key',
  'authorization',
  'client_secret',
  'code',
  'cookie',
  'csrf',
  'csrf_token',
  'password',
  'recovery_code',
  'refresh_token',
  'secret',
  'session',
  'session_id',
  'state',
  'token',
];
const sensitiveParameterPattern = new RegExp(
  `([?&;,\\s]|^)((?:${sensitiveParameterNames.join('|')}))=([^&;,\\s]+)`,
  'gi',
);

function normalizeKey(key) {
  if (typeof key !== 'string') {
    return '';
  }

  return key.toLowerCase().replaceAll(/[^a-z0-9]/g, '');
}

function sanitizePlainString(value) {
  return String(value)
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ')
    .replaceAll(sensitiveParameterPattern, (_match, prefix, key) => `${prefix}${key}=${redactedValue}`)
    .replaceAll(bearerPattern, redactedBearer)
    .replaceAll(emailPattern, redactedEmail)
    .replaceAll(windowsPathPattern, redactedPath)
    .replaceAll(unixPathPattern, redactedPath);
}

export function createControlPlaneRedactionService() {
  function redactValue(value, { key = null } = {}) {
    const normalizedKey = normalizeKey(key);

    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      if (sensitiveKeys.has(normalizedKey)) {
        return redactedValue;
      }

      if (pathKeys.has(normalizedKey)) {
        return redactedPath;
      }

      return sanitizePlainString(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((entry) => redactValue(entry));
    }

    if (typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([entryKey, entryValue]) => [
          entryKey,
          redactValue(entryValue, { key: entryKey }),
        ]),
      );
    }

    return value;
  }

  function redactAuditDetails(details) {
    if (!details || typeof details !== 'object' || Array.isArray(details)) {
      return {};
    }

    return redactValue(details);
  }

  function redactErrorMessage(message) {
    if (typeof message !== 'string' || message.length === 0) {
      return message ?? null;
    }

    return sanitizePlainString(message);
  }

  function redactLogMessage(message) {
    if (typeof message !== 'string' || message.length === 0) {
      return message ?? null;
    }

    return sanitizePlainString(message);
  }

  function redactOperationSummary(summary) {
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) {
      return {};
    }

    return redactValue(summary);
  }

  function redactMaintenanceLock(lock) {
    if (!lock || typeof lock !== 'object') {
      return null;
    }

    return {
      ...lock,
      reason: typeof lock.reason === 'string'
        ? sanitizePlainString(lock.reason)
        : lock.reason ?? null,
    };
  }

  return {
    redactAuditDetails,
    redactErrorMessage,
    redactLogMessage,
    redactMaintenanceLock,
    redactOperationSummary,
    redactValue,
  };
}
