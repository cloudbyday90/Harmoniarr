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
import { applySourceUserOutcomeEvidence } from './source-user-outcome-evidence-policy.js';
import { createSourceUserTrustMutation } from './source-user-trust-mutation-service.js';
import { assertDatabasePublicationScope } from '../database-publication-scope.js';
import { throwIfMediaCancelled } from '../media/media-cancellation.js';

function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
}

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
  mutateTrustSnapshot = null,
} = {}) {
  const mutate = createSourceUserTrustMutation({ mutateTrustSnapshot, listTrustSnapshot, replaceTrustSnapshot });

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

  async function recordSourceUserOutcomeEvidence({ actorUserId = null, eventType = null,
    occurredAt = new Date().toISOString(), outcome, qualityLabel = null, qualityWeight = 1,
    reason = null, username } = {}) {
    const normalizedUsername = normalizeOptionalString(username);
    if (!normalizedUsername || (outcome !== 'success' && outcome !== 'failure')) return null;
    const event = { actorUserId, eventType: normalizeOptionalString(eventType),
      occurredAt: typeof occurredAt === 'string' && occurredAt.trim() ? occurredAt : new Date().toISOString(),
      outcome, qualityLabel, qualityWeight, reason: normalizeOptionalString(reason), username: normalizedUsername };
    const projection = await mutate(async (rows, queryable) => {
      const result = applySourceUserOutcomeEvidence(rows, event);
      if (typeof appendOutcomeEventFn === 'function') {
        if (queryable) await queryable.query('SAVEPOINT trust_outcome_ledger');
        try { await appendOutcomeEventFn({ ...event, ...(queryable ? { queryable } : {}) }); }
        catch { if (queryable) await queryable.query('ROLLBACK TO SAVEPOINT trust_outcome_ledger'); }
        if (queryable) await queryable.query('RELEASE SAVEPOINT trust_outcome_ledger');
      }
      return result;
    });
    void notifyOutcome({ ...projection, actorUserId }).catch(() => {});
    return projection.nextRow;
  }

  async function recordSpectralOutcomeEvidence({ job, queryable, signal, qualityWeight, reason }) {
    assertDatabasePublicationScope(queryable, { kind: 'spectral_job', ownerId: job?.id });
    if (job?.origin !== 'apply' || !normalizeOptionalString(job?.username)
      || typeof appendOutcomeEventFn !== 'function') throw new TypeError('Durable apply-path spectral evidence is required');
    throwIfMediaCancelled(signal);
    const event = { id: job.id, eventType: 'spectral_analysis', occurredAt: new Date().toISOString(), outcome: 'failure',
      qualityLabel: 'spectral_transcode_confirmed', qualityWeight, reason, username: job.username, actorUserId: null };
    const projection = await mutate(async (rows, owned) => {
      const inserted = await appendOutcomeEventFn({ ...event, queryable: owned });
      if (!inserted) throw new Error('Spectral outcome event was not recorded');
      throwIfMediaCancelled(signal);
      return applySourceUserOutcomeEvidence(rows, event);
    }, { queryable, signal });
    return { recorded: true, afterCommit: () => notifyOutcome({ ...projection, actorUserId: null }) };
  }

  async function notifyOutcome({ nextRow, previousReviewState, actorUserId }) {
    const normalizedUsername = nextRow.username;
    const usernameKey = buildSourceUserUsernameKey(normalizedUsername);
    // Returned advisory work is awaited by spectral publication after commit;
    // legacy callers retain their explicitly detached advisory policy.
    const tasks = [];
    if (typeof onAutoIgnoreEvaluationFn === 'function' && typeof listRecentOutcomeEventsFn === 'function') {
      tasks.push((async () => {
        const events = await listRecentOutcomeEventsFn({ usernameKeys: [usernameKey] });
        const recencyWeighted = buildRecencyWeightedReputation({ events: Array.isArray(events) ? events : [] });
        const suggestion = evaluateAutoIgnoreSuggestion({ reputation: recencyWeighted });
        if (suggestion.suggested) await onAutoIgnoreEvaluationFn({ actorUserId, reputation: recencyWeighted, suggestion, username: normalizedUsername });
      })());
    }
    const nextView = mapSourceUserTrustRow(nextRow);
    if (typeof onTrustThresholdCrossedFn === 'function' && shouldAlertOnReviewTransition(previousReviewState, nextView.review?.state)) {
      tasks.push(Promise.resolve().then(() => onTrustThresholdCrossedFn({
        failureCount: nextView.reputation.failureCount, previousReviewState,
        reason: nextView.review?.reason ?? null, reviewState: nextView.review?.state ?? null,
        successCount: nextView.reputation.successCount, successRatePercent: nextView.reputation.successRatePercent,
        trustState: nextView.trustState, username: nextView.username,
      })));
    }
    await Promise.allSettled(tasks);
    return nextRow;
  }

  return {
    listSourceUserAutoIgnoreSuggestions,
    listSourceUserReputationIndex,
    recordSourceUserOutcomeEvidence,
    recordSpectralOutcomeEvidence,
  };
}
