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

function readValue(subject, camelKey, snakeKey) {
  if (!subject || typeof subject !== 'object') {
    return null;
  }

  if (Object.hasOwn(subject, camelKey)) {
    return subject[camelKey] ?? null;
  }

  if (Object.hasOwn(subject, snakeKey)) {
    return subject[snakeKey] ?? null;
  }

  return null;
}

function readNestedLocalAuth(subject) {
  if (!subject || typeof subject !== 'object' || !subject.localAuth || typeof subject.localAuth !== 'object') {
    return null;
  }

  return subject.localAuth;
}

export function buildLocalAuthStatus(subject) {
  const nestedLocalAuth = readNestedLocalAuth(subject);
  const passwordChangedAt = nestedLocalAuth?.passwordChangedAt ?? readValue(subject, 'passwordChangedAt', 'password_changed_at');
  const mustChangePassword = (nestedLocalAuth?.mustChangePassword ?? readValue(subject, 'mustChangePassword', 'must_change_password')) === true;
  const hasConfiguredPassword = passwordChangedAt !== null;

  return {
    hasConfiguredPassword,
    mustChangePassword,
    passwordChangedAt,
    unlinkPlexBlockedReason: hasConfiguredPassword ? null : 'local_password_not_configured',
    unlinkPlexReady: hasConfiguredPassword,
  };
}

export function isLocalAuthReadyForPlexUnlink(subject) {
  return buildLocalAuthStatus(subject).unlinkPlexReady;
}