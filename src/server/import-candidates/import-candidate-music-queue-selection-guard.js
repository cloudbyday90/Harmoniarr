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

const ACTIVE_MUSIC_QUEUE_CANDIDATE_STATUSES = Object.freeze([
  'selected',
  'downloading',
  'import_pending',
]);

function requireTransactionClient(client) {
  if (!client || typeof client.query !== 'function') {
    throw new TypeError('A PostgreSQL transaction client is required to guard Music Queue selection.');
  }
}

function normalizeIdentifier(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function mapActiveCandidate(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: row.status,
  };
}

/**
 * Serializes candidate selection for a shared Music Queue search.
 *
 * Discovery work is shared by metadata release, so all operator-owned wanted
 * releases that reference the same search must observe one active candidate.
 * Locking the discovery-request row makes the read of existing selections and
 * the subsequent candidate transition one short transaction-scoped decision.
 */
export function createImportCandidateMusicQueueSelectionGuard() {
  async function findActiveSelection({ candidate, client } = {}) {
    requireTransactionClient(client);

    const importCandidateId = normalizeIdentifier(candidate?.id);
    const sourceSearchId = normalizeIdentifier(candidate?.sourceSearchId);
    if (!importCandidateId || !sourceSearchId) {
      return null;
    }

    const discoveryRequestResult = await client.query(
      `
        SELECT library_discovery_requests.id
        FROM library_discovery_requests
        WHERE library_discovery_requests.evidence ->> 'lastSearchId' = $1
        ORDER BY library_discovery_requests.id ASC
        FOR UPDATE
      `,
      [sourceSearchId],
    );

    if (discoveryRequestResult.rows.length === 0) {
      return null;
    }

    const activeCandidateResult = await client.query(
      `
        SELECT id, status
        FROM import_candidates
        WHERE source_search_id = $1
          AND id <> $2::uuid
          AND status = ANY($3::text[])
        ORDER BY updated_at DESC, id ASC
        LIMIT 1
      `,
      [sourceSearchId, importCandidateId, ACTIVE_MUSIC_QUEUE_CANDIDATE_STATUSES],
    );

    return mapActiveCandidate(activeCandidateResult.rows[0]);
  }

  return {
    findActiveSelection,
  };
}
