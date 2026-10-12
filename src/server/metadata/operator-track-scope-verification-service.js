/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { isDeepStrictEqual } from 'node:util';
import { createApiError } from '../auth.js';
import { getPool } from '../database.js';
import { createOperatorTrackCatalogStore } from './operator-track-catalog-store.js';
import { lockMetadataSourceRead } from './metadata-source-lock-store.js';
import { isReleaseWideOperatorTrackScope, OPERATOR_TRACK_SCOPE_BLOCKER } from './operator-track-scope-policy.js';

const refused = () => createApiError(409, OPERATOR_TRACK_SCOPE_BLOCKER, 'Selected tracks need catalog and file verification before acquisition');
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/iu.test(value);

export function createOperatorTrackScopeVerificationService({ getPoolFn = getPool,
  catalogStore = createOperatorTrackCatalogStore({ getPoolFn }) } = {}) {
  async function assertScopesCurrent(scopes, { queryable = null } = {}) {
    if (!Array.isArray(scopes) || scopes.length === 0 || scopes.some(entry => !isReleaseWideOperatorTrackScope(entry?.scope))) throw refused();
    if (queryable) await lockMetadataSourceRead({ queryable });
    const tracks = await catalogStore.listTrackCatalog({ metadataReleaseIds: [...new Set(scopes.map(entry => entry.scope.metadataReleaseId))], queryable });
    for (const { scope } of scopes) {
      if (!isDeepStrictEqual(tracks.filter(track => track.metadataReleaseId === scope.metadataReleaseId), scope.tracks)) throw refused();
    }
  }
  async function assertCandidateCurrent(candidate, { queryable = null } = {}) {
    const query = (sql, params) => (queryable ?? getPoolFn()).query(sql, params);
    const context = candidate?.normalizedPayload?.musicQueue ?? candidate?.normalizedPayload?.musicQueueContext;
    const ids = [...new Set([context?.wantedReleaseId, ...(Array.isArray(context?.wantedReleaseIds) ? context.wantedReleaseIds : [])])].filter(uuid);
    const scopes = [];
    if (ids.length > 0) {
      const result = await query(`SELECT wanted.evidence,wanted.metadata_release_id FROM library_wanted_releases wanted
        WHERE wanted.id=ANY($1::uuid[]) OR wanted.metadata_release_id IN
        (SELECT metadata_release_id FROM library_wanted_releases WHERE id=ANY($1::uuid[]))`, [ids]);
      for (const row of result.rows) if (Object.hasOwn(row.evidence ?? {}, 'operatorTrackScope')) {
        if (row.evidence.operatorTrackScope?.metadataReleaseId !== row.metadata_release_id) throw refused();
        scopes.push({ scope: row.evidence.operatorTrackScope });
      }
    }
    const requestId = candidate?.normalizedPayload?.requestOwnership?.sourceMediaRequestId;
    if (uuid(requestId)) {
      const result = await query('SELECT evidence,matched_metadata_release_id FROM media_requests WHERE id=$1::uuid', [requestId]);
      for (const row of result.rows) if (Object.hasOwn(row.evidence?.operatorArtistReconciliation ?? {}, 'operatorTrackScope')) {
        if (row.evidence.operatorArtistReconciliation.operatorTrackScope?.metadataReleaseId !== row.matched_metadata_release_id) throw refused();
        scopes.push({ scope: row.evidence.operatorArtistReconciliation.operatorTrackScope });
      }
    }
    if (Object.hasOwn(context ?? {}, 'operatorTrackScopes')) {
      if (!Array.isArray(context.operatorTrackScopes) || context.operatorTrackScopes.length === 0 || scopes.length === 0) throw refused();
      scopes.push(...context.operatorTrackScopes);
    }
    if (scopes.length > 0) await assertScopesCurrent(scopes, { queryable });
  }
  async function assertCandidateIdCurrent(importCandidateId, { queryable = null } = {}) {
    if (!uuid(importCandidateId)) return;
    const result = await (queryable ?? getPoolFn()).query('SELECT normalized_payload FROM import_candidates WHERE id=$1::uuid', [importCandidateId]);
    if (result.rows.length !== 1) throw refused();
    await assertCandidateCurrent({ normalizedPayload: result.rows[0].normalized_payload }, { queryable });
  }
  return { assertScopesCurrent, assertCandidateCurrent, assertCandidateIdCurrent };
}
