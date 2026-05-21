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

function normalizeNow(nowFn) {
  const value = nowFn();
  if (value instanceof Date) {
    return value.getTime();
  }

  return Number(value) || Date.now();
}

function buildEntryKey({ cooldownKey, userId }) {
  return `${userId}:${cooldownKey}`;
}

export function createNotificationDispatchCooldownService({
  nowFn = () => new Date(),
} = {}) {
  const cooldownEntries = new Map();

  function shouldDispatch({ cooldownKey = null, cooldownMs = 0, userId }) {
    if (!cooldownKey || !userId || !Number.isFinite(cooldownMs) || cooldownMs < 1) {
      return true;
    }

    const entryKey = buildEntryKey({ cooldownKey, userId });
    const now = normalizeNow(nowFn);
    const expiresAt = cooldownEntries.get(entryKey) ?? 0;

    if (expiresAt <= now) {
      cooldownEntries.delete(entryKey);
      return true;
    }

    return false;
  }

  function markDispatched({ cooldownKey = null, cooldownMs = 0, userId }) {
    if (!cooldownKey || !userId || !Number.isFinite(cooldownMs) || cooldownMs < 1) {
      return;
    }

    cooldownEntries.set(
      buildEntryKey({ cooldownKey, userId }),
      normalizeNow(nowFn) + cooldownMs,
    );
  }

  return {
    markDispatched,
    shouldDispatch,
  };
}
