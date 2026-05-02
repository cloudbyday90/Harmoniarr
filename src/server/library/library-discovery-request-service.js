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
  const requestSourceEvidence = row.source_media_request_id
    ? {
        sourceMediaRequestId: row.source_media_request_id,
        sourceRequestKind: row.source_request_kind ?? null,
        sourceRequestedByUserId: row.source_requested_by_user_id ?? null,
      }
    : {};
  const releaseDateDeadline = buildReleaseDateInstant(row.release_date);
  const cooldownDeadline = buildCooldownDeadline(row.last_search_at, automaticCooldownMs);

  if (searchMode === 'manual') {
    return {
      blockedReason: null,
      evidence: {
        ...priorEvidence,
        ...requestSourceEvidence,
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
      ...requestSourceEvidence,
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
        WITH current_discovery AS (
          SELECT
            metadata_release_id,
            search_mode,
            blocked_reason,
            evidence,
            last_search_at,
            manual_requested_at
          FROM library_discovery_requests
        ),
        monitored_sources AS (
          SELECT
            1 AS source_priority,
            library_wanted_releases.metadata_artist_id,
            library_wanted_releases.metadata_release_group_id,
            library_wanted_releases.metadata_release_id,
            library_wanted_releases.release_date,
            library_wanted_releases.wanted_status,
            library_wanted_releases.evidence->>'strategy' AS wanted_strategy,
            NULL::uuid AS source_media_request_id,
            NULL::text AS source_request_kind,
            NULL::uuid AS source_requested_by_user_id,
            current_discovery.search_mode,
            current_discovery.blocked_reason,
            current_discovery.evidence AS prior_evidence,
            current_discovery.last_search_at,
            current_discovery.manual_requested_at
          FROM library_wanted_releases
          LEFT JOIN current_discovery
            ON current_discovery.metadata_release_id = library_wanted_releases.metadata_release_id
        ),
        request_sources AS (
          SELECT
            0 AS source_priority,
            release_groups.metadata_artist_id,
            COALESCE(media_requests.matched_metadata_release_group_id, metadata_releases.metadata_release_group_id) AS metadata_release_group_id,
            media_requests.matched_metadata_release_id AS metadata_release_id,
            metadata_releases.release_date,
            CASE
              WHEN COALESCE(library_release_reconciliations.reconciliation_status, 'missing') = 'partial' THEN 'partial'
              ELSE 'missing'
            END AS wanted_status,
            'media_request_intake' AS wanted_strategy,
            media_requests.id AS source_media_request_id,
            media_requests.request_kind AS source_request_kind,
            media_requests.requested_by_user_id AS source_requested_by_user_id,
            current_discovery.search_mode,
            current_discovery.blocked_reason,
            current_discovery.evidence AS prior_evidence,
            current_discovery.last_search_at,
            current_discovery.manual_requested_at
          FROM media_requests
          JOIN metadata_releases
            ON metadata_releases.id = media_requests.matched_metadata_release_id
          JOIN metadata_release_groups AS release_groups
            ON release_groups.id = COALESCE(
              media_requests.matched_metadata_release_group_id,
              metadata_releases.metadata_release_group_id
            )
          LEFT JOIN library_release_reconciliations
            ON library_release_reconciliations.metadata_release_id = media_requests.matched_metadata_release_id
          LEFT JOIN current_discovery
            ON current_discovery.metadata_release_id = media_requests.matched_metadata_release_id
          WHERE media_requests.request_state = 'needs_fetch'
            AND media_requests.matched_metadata_release_id IS NOT NULL
            AND COALESCE(library_release_reconciliations.reconciliation_status, 'missing') <> 'complete'
            AND COALESCE(library_release_reconciliations.reconciliation_status, 'missing') <> 'duplicate'
        ),
        deduped_sources AS (
          SELECT DISTINCT ON (source_rows.metadata_release_id)
            source_rows.metadata_artist_id,
            source_rows.metadata_release_group_id,
            source_rows.metadata_release_id,
            source_rows.release_date,
            source_rows.wanted_status,
            source_rows.wanted_strategy,
            source_rows.source_media_request_id,
            source_rows.source_request_kind,
            source_rows.source_requested_by_user_id,
            source_rows.search_mode,
            source_rows.blocked_reason,
            source_rows.prior_evidence,
            source_rows.last_search_at,
            source_rows.manual_requested_at
          FROM (
            SELECT * FROM request_sources
            UNION ALL
            SELECT * FROM monitored_sources
          ) AS source_rows
          ORDER BY source_rows.metadata_release_id ASC, source_rows.source_priority ASC, source_rows.release_date ASC NULLS LAST
        )
        SELECT
          deduped_sources.metadata_artist_id,
          deduped_sources.metadata_release_group_id,
          deduped_sources.metadata_release_id,
          deduped_sources.release_date,
          deduped_sources.wanted_status,
          deduped_sources.wanted_strategy,
          deduped_sources.source_media_request_id,
          deduped_sources.source_request_kind,
          deduped_sources.source_requested_by_user_id,
          deduped_sources.search_mode,
          deduped_sources.blocked_reason,
          deduped_sources.prior_evidence,
          deduped_sources.last_search_at,
          deduped_sources.manual_requested_at
        FROM deduped_sources
        ORDER BY deduped_sources.release_date NULLS LAST, deduped_sources.metadata_release_id ASC
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