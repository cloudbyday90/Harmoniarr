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

function formatIntervalLabel(intervalMs) {
  if (intervalMs % (60 * 60 * 1000) === 0) {
    const hours = intervalMs / (60 * 60 * 1000);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  if (intervalMs % (60 * 1000) === 0) {
    const minutes = intervalMs / (60 * 1000);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  const seconds = intervalMs / 1000;
  return `${seconds} second${seconds === 1 ? '' : 's'}`;
}

export function resolveHeartbeatIntervalConfig({
  env = process.env,
  envKey,
  fallbackIntervalMs,
  minimumIntervalMs = 1000,
} = {}) {
  if (!envKey) {
    throw new Error('envKey is required');
  }

  if (!Number.isInteger(fallbackIntervalMs) || fallbackIntervalMs < minimumIntervalMs) {
    throw new Error(`fallbackIntervalMs must be an integer greater than or equal to ${minimumIntervalMs}`);
  }

  const rawValue = env[envKey];
  let intervalMs = fallbackIntervalMs;
  let source = 'default';

  if (rawValue != null && rawValue !== '') {
    const parsed = Number.parseInt(String(rawValue), 10);
    if (!Number.isInteger(parsed) || parsed < minimumIntervalMs) {
      throw new Error(`Invalid ${envKey} value: ${rawValue}`);
    }

    intervalMs = parsed;
    source = 'environment';
  }

  return {
    intervalLabel: formatIntervalLabel(intervalMs),
    intervalMs,
    mode: 'automatic',
    source,
  };
}