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

import { getPool } from '../database.js';
import { createLibraryDiscoveryRequestStore } from './library-discovery-request-store.js';

const defaultAutomaticCooldownMs = 6 * 60 * 60 * 1000;

function toIsoStringOrNull(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function buildReleaseDateInstant(value) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildCooldownDeadline(lastSearchAt, cooldownMs) {
  if (!lastSearchAt) {
    return null;
  }

  const date = new Date(lastSearchAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(date.getTime() + cooldownMs);
}

function resolveAutomaticState({ cooldownDeadline, now, releaseDateDeadline }) {
  if (releaseDateDeadline && releaseDateDeadline.getTime() > now.getTime()) {
    return {
      blockedReason: 'release_date_pending',
      nextSearchAfter: releaseDateDeadline.toISOString(),
      requestStatus: 'blocked',
      strategy: 'release_date_gate',
    };
  }

  if (cooldownDeadline && cooldownDeadline.getTime() > now.getTime()) {
    return {
      blockedReason: 'automatic_cooldown',
      nextSearchAfter: cooldownDeadline.toISOString(),
      requestStatus: 'cooldown',
      strategy: 'cooldown_gate',
    };
  }

  return {
    blockedReason: null,
    nextSearchAfter: now.toISOString(),
    requestStatus: 'ready',
    strategy: 'eligible_now',
  };
}

function mapDiscoveryRow(row, { automaticCooldownMs, now }) {
  const searchMode = row.search_mode ?? 'automatic';
  const priorEvidence = row.prior_evidence && typeof row.prior_evidence === 'object'
    ? row.prior_evidence
    : {};
  const releaseDateDeadline = buildReleaseDateInstant(row.release_date);
  const cooldownDeadline = buildCooldownDeadline(row.last_search_at, automaticCooldownMs);

  if (searchMode === 'manual') {
    return {
      blockedReason: null,
      evidence: {
        ...priorEvidence,
        priorBlockedReason: row.blocked_reason ?? null,
        strategy: 'manual_override',
        wantedStrategy: row.wanted_strategy ?? null,
      },
      lastSearchAt: toIsoStringOrNull(row.last_search_at),
      manualRequestedAt: toIsoStringOrNull(row.manual_requested_at) ?? now.toISOString(),
      metadataArtistId: row.metadata_artist_id,
      metadataReleaseGroupId: row.metadata_release_group_id,
      metadataReleaseId: row.metadata_release_id,
      nextSearchAfter: now.toISOString(),
      releaseDate: row.release_date ?? null,
      requestStatus: 'ready',
      searchMode,
      wantedStatus: row.wanted_status,
    };
  }

  const automaticState = resolveAutomaticState({
    cooldownDeadline,
    now,
    releaseDateDeadline,
  });

  return {
    blockedReason: automaticState.blockedReason,
    evidence: {
      ...priorEvidence,
      automaticCooldownMs,
      cooldownDeadline: cooldownDeadline?.toISOString() ?? null,
      releaseDateGate: releaseDateDeadline?.toISOString() ?? null,
      strategy: automaticState.strategy,
      wantedStrategy: row.wanted_strategy ?? null,
    },
    lastSearchAt: toIsoStringOrNull(row.last_search_at),
    manualRequestedAt: toIsoStringOrNull(row.manual_requested_at),
    metadataArtistId: row.metadata_artist_id,
    metadataReleaseGroupId: row.metadata_release_group_id,
    metadataReleaseId: row.metadata_release_id,
    nextSearchAfter: automaticState.nextSearchAfter,
    releaseDate: row.release_date ?? null,
    requestStatus: automaticState.requestStatus,
    searchMode,
    wantedStatus: row.wanted_status,
  };
}

export function createLibraryDiscoveryRequestService({
  automaticCooldownMs = defaultAutomaticCooldownMs,
  getNow = () => new Date(),
  getPoolFn = getPool,
  libraryDiscoveryRequestStore = createLibraryDiscoveryRequestStore(),
} = {}) {
  async function loadDiscoveryRequests() {
    const pool = getPoolFn();
    const now = getNow();
    const result = await pool.query(
      `
        SELECT
          library_wanted_releases.metadata_artist_id,
          library_wanted_releases.metadata_release_group_id,
          library_wanted_releases.metadata_release_id,
          library_wanted_releases.release_date,
          library_wanted_releases.wanted_status,
          library_wanted_releases.evidence->>'strategy' AS wanted_strategy,
          library_discovery_requests.search_mode,
          library_discovery_requests.blocked_reason,
          library_discovery_requests.evidence AS prior_evidence,
          library_discovery_requests.last_search_at,
          library_discovery_requests.manual_requested_at
        FROM library_wanted_releases
        LEFT JOIN library_discovery_requests
          ON library_discovery_requests.metadata_release_id = library_wanted_releases.metadata_release_id
        ORDER BY library_wanted_releases.release_date NULLS LAST, library_wanted_releases.metadata_release_id ASC
      `,
    );

    return result.rows.map((row) => mapDiscoveryRow(row, {
      automaticCooldownMs,
      now,
    }));
  }

  async function reconcileDiscoveryRequests() {
    const discoveryRequests = await loadDiscoveryRequests();
    await libraryDiscoveryRequestStore.replaceLibraryDiscoveryRequests({ discoveryRequests });
  }

  return {
    reconcileDiscoveryRequests,
  };
}