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

// Pure decision policy for the opt-in auto-apply of ignore suggestions. It
// decides whether a confident reputation suggestion should be turned into an
// ignore-list entry automatically, under operator-controlled gates:
//
//   1. enabled    - the operator has switched auto-apply on (default OFF).
//   2. suggested  - the reputation model produced a confident suggestion.
//   3. dedupe     - the peer is not already on the ignore list.
//   4. cooldown   - the peer was not auto-evaluated within the cooldown window,
//                   which provides hysteresis so the loop cannot flap or churn
//                   on every new outcome event.
//
// This module performs no IO and has no side effects; it only returns a
// decision that a service applies.

const MS_PER_HOUR = 60 * 60 * 1000;
const DEFAULT_COOLDOWN_HOURS = 24;

function resolveTimestampMs(value) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function resolveCooldownHours(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_COOLDOWN_HOURS;
  }
  return parsed;
}

/**
 * Decides whether an auto-ignore suggestion should be applied automatically.
 *
 * @param {object} [params]
 * @param {object} [params.suggestion] output of evaluateAutoIgnoreSuggestion
 * @param {object|null} [params.existingEntry] current ignore entry for the peer, if any
 * @param {object} [params.settings] acquisition settings ({ autoIgnoreEnabled, autoIgnoreCooldownHours })
 * @param {number|string|Date} [params.now] evaluation instant
 * @returns {{ apply: boolean, skipReason: string|null, source: 'auto_suggested' }}
 */
export function evaluateAutoIgnoreApplication({
  suggestion = null,
  existingEntry = null,
  settings = null,
  now = Date.now(),
} = {}) {
  const result = { apply: false, skipReason: null, source: 'auto_suggested' };

  const enabled = settings?.autoIgnoreEnabled === true;
  if (!enabled) {
    result.skipReason = 'auto_apply_disabled';
    return result;
  }

  if (!suggestion || suggestion.suggested !== true) {
    result.skipReason = 'not_suggested';
    return result;
  }

  if (existingEntry) {
    // Already ignored. If a previous auto-evaluation happened recently, treat it
    // as cooling down (hysteresis); otherwise it is simply a no-op dedupe.
    const lastEvaluatedMs = resolveTimestampMs(existingEntry.lastAutoEvaluatedAt ?? existingEntry.updatedAt);
    const cooldownMs = resolveCooldownHours(settings?.autoIgnoreCooldownHours) * MS_PER_HOUR;
    const nowMs = resolveTimestampMs(now) ?? Date.now();
    if (lastEvaluatedMs !== null && cooldownMs > 0 && (nowMs - lastEvaluatedMs) < cooldownMs) {
      result.skipReason = 'cooldown';
      return result;
    }
    result.skipReason = 'already_ignored';
    return result;
  }

  result.apply = true;
  return result;
}
