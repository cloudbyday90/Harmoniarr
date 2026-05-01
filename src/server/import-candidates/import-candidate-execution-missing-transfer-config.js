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

const defaultMissingTransferGraceMs = 5 * 60 * 1000;

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

export function resolveImportCandidateExecutionMissingTransferConfig({
  env = process.env,
  fallbackGraceMs = defaultMissingTransferGraceMs,
} = {}) {
  const rawValue = env.HARMONIARR_IMPORT_EXECUTION_MISSING_TRANSFER_GRACE_MS;
  let gracePeriodMs = fallbackGraceMs;
  let source = 'default';

  if (rawValue != null && rawValue !== '') {
    const parsed = Number.parseInt(String(rawValue), 10);
    if (!Number.isInteger(parsed) || parsed < 1000) {
      throw new Error(`Invalid HARMONIARR_IMPORT_EXECUTION_MISSING_TRANSFER_GRACE_MS value: ${rawValue}`);
    }

    gracePeriodMs = parsed;
    source = 'environment';
  }

  return {
    gracePeriodLabel: formatIntervalLabel(gracePeriodMs),
    gracePeriodMs,
    mode: 'grace_window',
    source,
  };
}