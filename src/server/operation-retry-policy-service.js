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

const defaultInitialBackoffMs = 30 * 1000;
const defaultJitterRatio = 0.1;
const defaultMaxBackoffMs = 15 * 60 * 1000;
const defaultMultiplier = 2;

function normalizePositiveInteger(value, fallback, { minimum = 1 } = {}) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < minimum) {
    return fallback;
  }

  return parsed;
}

function normalizeJitterRatio(value, fallback = defaultJitterRatio) {
  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }

  return parsed;
}

export function createOperationRetryPolicyService({
  initialBackoffMs = defaultInitialBackoffMs,
  jitterRatio = defaultJitterRatio,
  maxBackoffMs = defaultMaxBackoffMs,
  multiplier = defaultMultiplier,
  nowFn = () => new Date(),
  randomFn = Math.random,
} = {}) {
  const resolvedInitialBackoffMs = normalizePositiveInteger(initialBackoffMs, defaultInitialBackoffMs);
  const resolvedJitterRatio = normalizeJitterRatio(jitterRatio);
  const resolvedMaxBackoffMs = normalizePositiveInteger(maxBackoffMs, defaultMaxBackoffMs);
  const resolvedMultiplier = normalizePositiveInteger(multiplier, defaultMultiplier);

  function buildRetrySchedule({ attemptCount, maxAttempts }) {
    const resolvedAttemptCount = normalizePositiveInteger(attemptCount, 0, { minimum: 0 });
    const resolvedMaxAttempts = normalizePositiveInteger(maxAttempts, 1);

    if (resolvedAttemptCount < 1 || resolvedAttemptCount >= resolvedMaxAttempts) {
      return null;
    }

    const retryIndex = Math.max(0, resolvedAttemptCount - 1);
    const baseDelayMs = Math.min(
      resolvedMaxBackoffMs,
      resolvedInitialBackoffMs * (resolvedMultiplier ** retryIndex),
    );
    const jitterMs = Math.round(baseDelayMs * resolvedJitterRatio * randomFn());
    const delayMs = baseDelayMs + jitterMs;
    const scheduledAt = nowFn();

    return {
      attemptCount: resolvedAttemptCount,
      delayMs,
      nextAttemptAt: new Date(scheduledAt.getTime() + delayMs).toISOString(),
      scheduledAt: scheduledAt.toISOString(),
    };
  }

  return {
    buildRetrySchedule,
  };
}