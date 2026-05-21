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

function normalizeTimestamp(value) {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildEntryKey({ cooldownKey, userId }) {
  return `${userId}:${cooldownKey}`;
}

export function createNotificationDispatchCooldownService({
  dispatchHistoryService = null,
  nowFn = () => new Date(),
} = {}) {
  const cooldownEntries = new Map();

  async function shouldDispatch({ category = null, cooldownKey = null, cooldownMs = 0, userId }) {
    if (!cooldownKey || !userId || !Number.isFinite(cooldownMs) || cooldownMs < 1) {
      return true;
    }

    const entryKey = buildEntryKey({ cooldownKey, userId });
    const now = normalizeNow(nowFn);
    const expiresAt = cooldownEntries.get(entryKey) ?? 0;

    if (expiresAt <= now) {
      cooldownEntries.delete(entryKey);
      const since = new Date(now - cooldownMs).toISOString();
      const latestDispatchAt = dispatchHistoryService?.getLatestDispatchAt
        ? await dispatchHistoryService.getLatestDispatchAt({ category, cooldownKey, since, userId })
        : null;
      const persistedDispatchedAt = normalizeTimestamp(latestDispatchAt);

      if (persistedDispatchedAt > 0 && persistedDispatchedAt + cooldownMs > now) {
        cooldownEntries.set(entryKey, persistedDispatchedAt + cooldownMs);
        return false;
      }

      return true;
    }

    return false;
  }

  async function markDispatched({ category = null, cooldownKey = null, cooldownMs = 0, payload = {}, userId }) {
    if (!cooldownKey || !userId || !Number.isFinite(cooldownMs) || cooldownMs < 1) {
      return;
    }

    cooldownEntries.set(
      buildEntryKey({ cooldownKey, userId }),
      normalizeNow(nowFn) + cooldownMs,
    );

    if (dispatchHistoryService?.recordDispatch) {
      await dispatchHistoryService.recordDispatch({
        category,
        cooldownKey,
        cooldownMs,
        payload,
        userId,
      });
    }
  }

  return {
    markDispatched,
    shouldDispatch,
  };
}
