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

/**
 * Pure resolver for control-plane ledger retention configuration.
 *
 * Security posture (OWASP Logging Cheat Sheet — Disposal & Availability):
 * - A documented minimum-retention floor guarantees evidence survives long
 *   enough for incident review; values can never be clamped below it.
 * - A documented ceiling guarantees an append-only ledger cannot grow without
 *   bound (a disk-exhaustion / availability control).
 * Clamping is applied here as defense-in-depth even when settings validation
 * is bypassed (e.g. legacy rows or direct database edits).
 */

export const ledgerRetentionBounds = Object.freeze({
  operationRunMaxAgeDays: Object.freeze({ default: 90, min: 7, max: 3650 }),
  operationRunRetainCountPerType: Object.freeze({ default: 50, min: 10, max: 1000 }),
  outcomeEventMaxAgeDays: Object.freeze({ default: 180, min: 30, max: 3650 }),
});

function clampInteger(value, { default: fallback, min, max }) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(parsed, max));
}

/**
 * Resolves a normalized, clamped retention policy from the persisted settings
 * tree. Accepts the full settings object (or just the `retention` namespace)
 * and tolerates missing/partial input by falling back to secure defaults.
 *
 * @param {object} [settings] Persisted settings (full tree or `retention` slice).
 * @returns {{ operationRuns: { retainCountPerType: number, maxAgeDays: number }, outcomeEvents: { maxAgeDays: number } }}
 */
export function resolveLedgerRetentionPolicy(settings = {}) {
  const retention = settings?.retention && typeof settings.retention === 'object'
    ? settings.retention
    : settings ?? {};

  return {
    operationRuns: {
      maxAgeDays: clampInteger(retention.operationRunMaxAgeDays, ledgerRetentionBounds.operationRunMaxAgeDays),
      retainCountPerType: clampInteger(
        retention.operationRunRetainCountPerType,
        ledgerRetentionBounds.operationRunRetainCountPerType,
      ),
    },
    outcomeEvents: {
      maxAgeDays: clampInteger(retention.outcomeEventMaxAgeDays, ledgerRetentionBounds.outcomeEventMaxAgeDays),
    },
  };
}

/**
 * Converts a `maxAgeDays` window into an absolute ISO cutoff timestamp.
 * Rows strictly older than the returned cutoff are eligible for disposal.
 *
 * @param {number} maxAgeDays Retention window in days (already clamped).
 * @param {Date} [now] Reference clock (injectable for tests).
 * @returns {string} ISO-8601 cutoff timestamp.
 */
export function resolveRetentionCutoffIso(maxAgeDays, now = new Date()) {
  const reference = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const cutoff = new Date(reference.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
  return cutoff.toISOString();
}
