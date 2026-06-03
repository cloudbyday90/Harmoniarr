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

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

import {
  buildSourceUserUsernameKey,
  mapSourceUserTrustRow,
  normalizeSourceUserTrustSnapshotRows,
  resolveSourceUserTrustState,
} from './source-user-trust-service.js';
import {
  buildRecencyWeightedReputation,
  evaluateAutoIgnoreSuggestion,
} from './source-user-reputation-model.js';
import { HISTORY_RETENTION_MS, MAX_TRUST_HISTORY_ENTRIES } from './trust-history-constants.js';

const ALERTABLE_REVIEW_STATES = new Set(['watch', 'excluded']);

function toNonNegativeInteger(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function mapReputationRow(row) {
  return {
    failureCount: toNonNegativeInteger(row?.failureCount),
    successCount: toNonNegativeInteger(row?.successCount),
    trustState: resolveSourceUserTrustState(row),
    username: normalizeOptionalString(row?.username),
  };
}

function compactExpiredEntries(rows) {
  const cutoff = Date.now() - HISTORY_RETENTION_MS;
  return rows.filter((row) => {
    if (row.kind === 'manual_override' || row.kind === 'blocklist_event') {
      return true;
    }

    const timestamp = typeof row.occurredAt === 'string' ? Date.parse(row.occurredAt) : 0;
    return timestamp >= cutoff;
  });
}

function normalizeTrustHistory(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return compactExpiredEntries(
    rows
      .filter((row) => row && typeof row === 'object')
      .map((row) => ({ ...row })),
  )
    .sort((a, b) => {
      const timeA = typeof a.occurredAt === 'string' ? Date.parse(a.occurredAt) : 0;
      const timeB = typeof b.occurredAt === 'string' ? Date.parse(b.occurredAt) : 0;
      return timeB - timeA;
    })
    .slice(0, MAX_TRUST_HISTORY_ENTRIES);
}

function appendTrustHistory(row, entry) {
  return normalizeTrustHistory([entry, ...(Array.isArray(row?.trustHistory) ? row.trustHistory : [])]);
}

function resolveReviewState(row) {
  return mapSourceUserTrustRow(row).review?.state ?? null;
}

function shouldAlertOnReviewTransition(previousState, nextState) {
  return ALERTABLE_REVIEW_STATES.has(nextState)
    && previousState !== nextState;
}

export function createSourceUserTrustEvidenceService({
  appendOutcomeEventFn = null,
  listRecentOutcomeEventsFn = null,
  listTrustSnapshot = async () => [],
  onAutoIgnoreEvaluationFn = null,
  onTrustThresholdCrossedFn = null,
  replaceTrustSnapshot = async () => {},
} = {}) {
  async function loadRecencyEnrichment(usernameKeys) {
    if (typeof listRecentOutcomeEventsFn !== 'function' || usernameKeys.length === 0) {
      return new Map();
    }

    let events;
    try {
      events = await listRecentOutcomeEventsFn({ usernameKeys });
    } catch {
      return new Map();
    }

    const eventsByKey = new Map();
    for (const event of Array.isArray(events) ? events : []) {
      const key = buildSourceUserUsernameKey(event?.usernameKey ?? event?.username);
      if (!key) {
        continue;
      }
      const bucket = eventsByKey.get(key);
      if (bucket) {
        bucket.push(event);
      } else {
        eventsByKey.set(key, [event]);
      }
    }

    const enrichmentByKey = new Map();
    for (const [key, keyEvents] of eventsByKey) {
      const recencyWeighted = buildRecencyWeightedReputation({ events: keyEvents });
      const autoIgnoreSuggestion = evaluateAutoIgnoreSuggestion({ reputation: recencyWeighted });
      enrichmentByKey.set(key, { autoIgnoreSuggestion, recencyWeighted });
    }

    return enrichmentByKey;
  }

  async function listSourceUserReputationIndex({ usernames } = {}) {
    const rows = normalizeSourceUserTrustSnapshotRows(await listTrustSnapshot());
    const usernameFilter = Array.isArray(usernames)
      ? new Set(usernames.map((value) => buildSourceUserUsernameKey(value)).filter(Boolean))
      : null;
    const reputationIndex = new Map();
    const includedKeys = [];

    for (const row of rows) {
      const reputation = mapReputationRow(row);
      const usernameKey = buildSourceUserUsernameKey(reputation.username);
      if (!usernameKey) {
        continue;
      }

      if (usernameFilter && !usernameFilter.has(usernameKey)) {
        continue;
      }

      reputationIndex.set(usernameKey, reputation);
      includedKeys.push(usernameKey);
    }

    const enrichmentByKey = await loadRecencyEnrichment(includedKeys);
    for (const [usernameKey, enrichment] of enrichmentByKey) {
      const reputation = reputationIndex.get(usernameKey);
      if (reputation) {
        reputationIndex.set(usernameKey, { ...reputation, ...enrichment });
      }
    }

    return reputationIndex;
  }

  // Route-friendly projection of the reputation index: returns a JSON-serializable
  // array of peers the auto-ignore heuristic currently flags, newest signal first.
  // Operators consume this to action one-click ignores without auto-apply enabled.
  async function listSourceUserAutoIgnoreSuggestions() {
    const reputationIndex = await listSourceUserReputationIndex();
    const suggestions = [];
    for (const reputation of reputationIndex.values()) {
      const suggestion = reputation?.autoIgnoreSuggestion;
      if (suggestion?.suggested === true) {
        suggestions.push({
          username: reputation.username,
          trustState: reputation.trustState ?? null,
          successCount: reputation.successCount ?? 0,
          failureCount: reputation.failureCount ?? 0,
          recencyWeighted: reputation.recencyWeighted ?? null,
          suggestion: {
            reason: suggestion.reason ?? null,
            signals: suggestion.signals ?? null,
          },
        });
      }
    }
    suggestions.sort((a, b) => (b.failureCount ?? 0) - (a.failureCount ?? 0));
    return { suggestions, total: suggestions.length };
  }

  async function recordSourceUserOutcomeEvidence({
    actorUserId = null,
    eventType = null,
    occurredAt = new Date().toISOString(),
    outcome,
    qualityLabel = null,
    qualityWeight = 1,
    reason = null,
    username,
  } = {}) {
    const normalizedUsername = normalizeOptionalString(username);
    if (!normalizedUsername || (outcome !== 'success' && outcome !== 'failure')) {
      return null;
    }

    const usernameKey = buildSourceUserUsernameKey(normalizedUsername);
    const rows = normalizeSourceUserTrustSnapshotRows(await listTrustSnapshot());
    const existingIndex = rows.findIndex((row) => buildSourceUserUsernameKey(row?.username) === usernameKey);
    const existing = existingIndex >= 0 ? rows[existingIndex] : null;
    const previousReviewState = existing ? resolveReviewState(existing) : null;
    const updatedAt = typeof occurredAt === 'string' && occurredAt.trim() ? occurredAt : new Date().toISOString();
    const normalizedReason = normalizeOptionalString(reason);
    const normalizedEventType = normalizeOptionalString(eventType);
    const historyEntry = {
      actorUserId,
      eventType: normalizedEventType,
      id: `${updatedAt}:${normalizedEventType ?? outcome}:${outcome}:${toNonNegativeInteger(existing?.successCount) + toNonNegativeInteger(existing?.failureCount) + 1}`,
      kind: 'delivery_evidence',
      occurredAt: updatedAt,
      outcome,
      reason: normalizedReason,
    };
    const nextRow = {
      ...(existing ?? {}),
      failureCount: toNonNegativeInteger(existing?.failureCount) + (outcome === 'failure' ? 1 : 0),
      isBlocked: existing?.isBlocked === true,
      lastEvidenceAt: updatedAt,
      lastEvidenceEventType: normalizedEventType,
      lastEvidenceOutcome: outcome,
      lastEvidenceReason: normalizedReason,
      successCount: toNonNegativeInteger(existing?.successCount) + (outcome === 'success' ? 1 : 0),
      trustHistory: appendTrustHistory(existing, historyEntry),
      trustState: resolveSourceUserTrustState(existing),
      updatedAt,
      username: existing?.username ?? normalizedUsername,
      ...(outcome === 'success'
        ? {
          lastSuccessfulAt: updatedAt,
          lastSuccessfulEventType: normalizedEventType,
          lastSuccessfulReason: normalizedReason,
        }
        : {
          lastFailureAt: updatedAt,
          lastFailureEventType: normalizedEventType,
          lastFailureReason: normalizedReason,
        }),
    };

    if (existingIndex >= 0) {
      rows.splice(existingIndex, 1, nextRow);
    } else {
      rows.push(nextRow);
    }

    // Append-only ledger write: a pure INSERT that is inherently free of the
    // read-modify-write lost-update race in the snapshot rewrite below. This is
    // the durable, concurrency-safe evidence source for recency-weighted
    // reputation. Best-effort so a ledger hiccup never blocks the outcome path.
    if (typeof appendOutcomeEventFn === 'function') {
      try {
        await appendOutcomeEventFn({
          actorUserId,
          eventType: normalizedEventType,
          occurredAt: updatedAt,
          outcome,
          qualityLabel,
          qualityWeight,
          reason: normalizedReason,
          username: normalizedUsername,
        });
      } catch {
        // Intentionally swallowed: ledger durability is best-effort relative to
        // the operator-facing trust snapshot.
      }
    }

    await replaceTrustSnapshot({ sourceUsers: rows });

    // Closed-loop hook: after the durable ledger write, recompute this single
    // peer's recency-weighted reputation and hand the explainable suggestion to
    // the opt-in auto-ignore policy. Fire-and-forget so it never blocks or
    // breaks the outcome path; gated entirely by the injected handler.
    if (typeof onAutoIgnoreEvaluationFn === 'function' && typeof listRecentOutcomeEventsFn === 'function') {
      void (async () => {
        try {
          const events = await listRecentOutcomeEventsFn({ usernameKeys: [usernameKey] });
          const recencyWeighted = buildRecencyWeightedReputation({ events: Array.isArray(events) ? events : [] });
          const suggestion = evaluateAutoIgnoreSuggestion({ reputation: recencyWeighted });
          if (!suggestion.suggested) {
            return;
          }
          await onAutoIgnoreEvaluationFn({
            actorUserId,
            reputation: recencyWeighted,
            suggestion,
            username: normalizedUsername,
          });
        } catch {
          // Advisory convenience: a failure here must not affect outcome recording.
        }
      })();
    }

    const nextView = mapSourceUserTrustRow(nextRow);
    if (typeof onTrustThresholdCrossedFn === 'function' && shouldAlertOnReviewTransition(previousReviewState, nextView.review?.state)) {
      void onTrustThresholdCrossedFn({
        failureCount: nextView.reputation.failureCount,
        previousReviewState,
        reason: nextView.review?.reason ?? null,
        reviewState: nextView.review?.state ?? null,
        successCount: nextView.reputation.successCount,
        successRatePercent: nextView.reputation.successRatePercent,
        trustState: nextView.trustState,
        username: nextView.username,
      }).catch(() => {});
    }

    return nextRow;
  }

  return {
    listSourceUserAutoIgnoreSuggestions,
    listSourceUserReputationIndex,
    recordSourceUserOutcomeEvidence,
  };
}
