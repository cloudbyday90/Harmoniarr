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

import { recordAuditEvent } from '../audit.js';
import { loadSettings } from '../settings.js';
import { createSourceUserIgnoreStore } from './source-user-ignore-store.js';
import { evaluateAutoIgnoreApplication } from './source-user-auto-ignore-policy.js';

function resolveAcquisitionSettings(settings) {
  const acquisition = settings?.acquisition ?? {};
  return {
    autoIgnoreEnabled: acquisition.autoIgnoreEnabled === true,
    autoIgnoreCooldownHours: Number.isFinite(Number(acquisition.autoIgnoreCooldownHours))
      ? Number(acquisition.autoIgnoreCooldownHours)
      : 24,
  };
}

/**
 * Service that closes the learn->act loop for source-user ignoring: it surfaces
 * the ignore list to the G6 candidate source filter, applies operator decisions
 * (one-click and opt-in auto-apply), and emits an audit trail for every change.
 */
export function createSourceUserIgnoreService({
  ignoreStore = createSourceUserIgnoreStore(),
  loadSettingsFn = loadSettings,
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  /**
   * Returns the current ignored usernames for the candidate source filter
   * (G6 ignoredUsernames). Best-effort: a lookup failure must never break the
   * acquisition hot path, so it degrades to an empty list.
   */
  async function listIgnoredUsernamesForFilter() {
    try {
      return await ignoreStore.listIgnoredUsernames();
    } catch {
      return [];
    }
  }

  async function listIgnoredSourceUsers() {
    return ignoreStore.listIgnoreEntries();
  }

  /**
   * Applies an ignore decision made by an operator (one-click "apply suggestion
   * to ignore list" or a direct ignore).
   */
  async function applyIgnoreSuggestion({
    actorUserId = null,
    reason = null,
    suggestionSignals = null,
    username,
  } = {}) {
    const entry = await ignoreStore.upsertIgnoreEntry({
      actorUserId,
      reason,
      source: 'manual',
      suggestionSignals,
      username,
    });

    if (!entry) {
      return null;
    }

    await recordAuditEventFn({
      actorUserId,
      actorType: 'user',
      eventType: 'source_user_ignored',
      summary: `Source user "${entry.username}" added to the ignore list`,
      details: { reason: entry.reason, source: 'manual', username: entry.username },
    });

    return entry;
  }

  async function removeIgnoredUser({ actorUserId = null, username } = {}) {
    const existing = await ignoreStore.getIgnoreEntry({ username });
    const { removedCount } = await ignoreStore.removeIgnoreEntry({ username });

    if (removedCount > 0) {
      await recordAuditEventFn({
        actorUserId,
        actorType: 'user',
        eventType: 'source_user_unignored',
        summary: `Source user "${existing?.username ?? username}" removed from the ignore list`,
        details: { username: existing?.username ?? username },
      });
    }

    return { removedCount };
  }

  /**
   * Evaluates a fresh reputation suggestion for a single peer against the opt-in
   * auto-apply policy and, when permitted, adds the peer to the ignore list and
   * records an audit event. Idempotent and best-effort: callers invoke it on the
   * outcome-recording hot path, so it never throws.
   *
   * @returns {Promise<{ applied: boolean, skipReason: string|null }>}
   */
  async function evaluateAutoIgnoreForUser({
    actorUserId = null,
    reputation = null,
    suggestion = null,
    username,
  } = {}) {
    try {
      const settings = resolveAcquisitionSettings(await loadSettingsFn());
      if (!settings.autoIgnoreEnabled) {
        return { applied: false, skipReason: 'auto_apply_disabled' };
      }

      const existingEntry = await ignoreStore.getIgnoreEntry({ username });
      const decision = evaluateAutoIgnoreApplication({
        existingEntry,
        settings,
        suggestion,
      });

      if (!decision.apply) {
        // Refresh the cooldown clock when we re-evaluate an already-ignored peer
        // so repeated outcomes do not re-trigger churn before the cooldown ends.
        if (decision.skipReason === 'already_ignored' && existingEntry) {
          await ignoreStore.touchAutoEvaluation({ username });
        }
        return { applied: false, skipReason: decision.skipReason };
      }

      const entry = await ignoreStore.upsertIgnoreEntry({
        actorUserId,
        reason: suggestion?.reason ?? null,
        source: 'auto_suggested',
        suggestionSignals: {
          reason: suggestion?.reason ?? null,
          signals: suggestion?.signals ?? null,
          recencyWeighted: reputation
            ? {
              decayedFailureRatio: reputation.decayedFailureRatio ?? null,
              sampleSize: reputation.sampleSize ?? null,
              wilsonUpperBound: reputation.wilsonUpperBound ?? null,
            }
            : null,
        },
        username,
      });

      if (!entry) {
        return { applied: false, skipReason: 'upsert_failed' };
      }

      await recordAuditEventFn({
        actorUserId,
        actorType: 'system',
        eventType: 'source_user_auto_ignored',
        summary: `Source user "${entry.username}" auto-added to the ignore list from delivery evidence`,
        details: { reason: entry.reason, source: 'auto_suggested', username: entry.username },
      });

      return { applied: true, skipReason: null };
    } catch {
      // Auto-apply is an advisory convenience layered on the outcome path; a
      // failure here must never block outcome recording or acquisition.
      return { applied: false, skipReason: 'error' };
    }
  }

  return {
    applyIgnoreSuggestion,
    evaluateAutoIgnoreForUser,
    listIgnoredSourceUsers,
    listIgnoredUsernamesForFilter,
    removeIgnoredUser,
  };
}
