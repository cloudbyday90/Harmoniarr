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

import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { createOperatorReconciliationPublicationService } from './operator-reconciliation-publication-service.js';
import { getPool } from '../database.js';
import { createLibraryMediaRequestStore } from '../library/library-media-request-store.js';
import { normalizeMetadataReleaseDateForDateColumn } from './metadata-release-date-normalization.js';

function normalizeQuery(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildNormalizedQuery({ artistName, releaseTitle }) {
  return normalizeQuery([artistName, releaseTitle].filter(Boolean).join(' '));
}

function hashString32(value) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash | 0;
}

function buildRequestIdentityKey({ artistName, desiredRelease }) {
  if (typeof desiredRelease?.musicbrainzReleaseId === 'string' && desiredRelease.musicbrainzReleaseId.length > 0) {
    return `mbid:${desiredRelease.musicbrainzReleaseId}`;
  }

  return `text:${buildNormalizedQuery({
    artistName,
    releaseTitle: desiredRelease?.releaseTitle ?? desiredRelease?.releaseGroupTitle ?? null,
  })}`;
}

async function acquireRequestIdentityLock({ client, requestIdentityKey }) {
  await client.query(
    'SELECT pg_advisory_xact_lock($1::integer, $2::integer)',
    [
      hashString32('operator_artist_reconciliation_request'),
      hashString32(requestIdentityKey),
    ],
  );
}

function uniqueDesiredReleases(desiredReleases = []) {
  const seenReleaseIds = new Set();
  const uniqueReleases = [];

  for (const desiredRelease of desiredReleases) {
    const metadataReleaseId = typeof desiredRelease?.metadataReleaseId === 'string'
      ? desiredRelease.metadataReleaseId.trim()
      : '';

    if (metadataReleaseId.length === 0 || seenReleaseIds.has(metadataReleaseId)) {
      continue;
    }

    seenReleaseIds.add(metadataReleaseId);
    uniqueReleases.push(desiredRelease);
  }

  return uniqueReleases;
}

function buildRequestEvidence({
  appUserId,
  desiredRelease,
  snapshotId,
  snapshotRevision,
}) {
  return {
    automationSource: 'operator_artist_reconciliation',
    metadataArtistId: desiredRelease.metadataArtistId ?? null,
    metadataReleaseGroupId: desiredRelease.metadataReleaseGroupId,
    metadataReleaseId: desiredRelease.metadataReleaseId,
    operatorArtistReconciliation: {
      appUserId,
      isExplicitSelection: desiredRelease.isExplicitSelection === true,
      ...(desiredRelease.operatorTrackScope ? { operatorTrackScope: desiredRelease.operatorTrackScope } : {}),
      selectionState: desiredRelease.selectionState ?? 'selected',
      snapshotId,
      snapshotRevision,
      source: 'metadata_operator_reconciliation',
    },
  };
}

export function createOperatorArtistReconciliationRequestService({
  getPoolFn = getPool,
  publicationGuard = createOperatorReconciliationPublicationService(),
  withTransaction = createDatabaseTransactionRunner({ getPoolFn }),
  createMediaRequest = null,
  findActiveDuplicateRequest = null,
  insertMediaRequestEvent = null,
  reconcileDiscoveryRequests = null,
  libraryMediaRequestStore = null,
} = {}) {
  const resolvedLibraryMediaRequestStore = libraryMediaRequestStore
    ?? createLibraryMediaRequestStore();
  const createSharedMediaRequest = createMediaRequest
    ?? resolvedLibraryMediaRequestStore.createMediaRequest;
  const findSharedDuplicateRequest = findActiveDuplicateRequest
    ?? resolvedLibraryMediaRequestStore.findActiveDuplicateRequest;
  const insertSharedMediaRequestEvent = insertMediaRequestEvent
    ?? resolvedLibraryMediaRequestStore.insertMediaRequestEvent;

  async function materializeDesiredReleaseRequests({
    appUserId,
    metadataArtistId,
    artistName,
    desiredReleases = [],
    snapshotId,
    snapshotRevision,
    workerContext,
    publicationSource,
    throwIfCancelled = async () => {},
  } = {}) {
    const prepared = publicationGuard.capture({ appUserId, metadataArtistId, snapshotId, snapshotRevision, workerContext, publicationSource });
    const eligibleDesiredReleases = uniqueDesiredReleases(structuredClone(Array.isArray(desiredReleases) ? desiredReleases : []));
    const createdRequestIds = [];
    const createdRequests = [];
    let duplicateSuppressedCount = 0;
    let skippedRequestCount = 0;

    try {
      for (const desiredRelease of eligibleDesiredReleases) {
        if (!desiredRelease?.eligibleForDownstreamWork) { skippedRequestCount += 1; continue; }
        await throwIfCancelled();
        const mediaRequest = await withTransaction(async queryable => {
          await queryable.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
          const authority = { prepared, desiredRelease, artistName, queryable };
          await publicationGuard.lockContext({ prepared, queryable });
          await publicationGuard.assertCurrent(authority);
          await acquireRequestIdentityLock({ client: queryable, requestIdentityKey: buildRequestIdentityKey({ artistName, desiredRelease }) });
          const duplicateRequest = await findSharedDuplicateRequest({ artistName,
            musicbrainzReleaseId: desiredRelease.musicbrainzReleaseId ?? null,
            releaseTitle: desiredRelease.releaseTitle ?? desiredRelease.releaseGroupTitle ?? null, queryable });
          if (duplicateRequest) return null;
          await throwIfCancelled({ queryable });
          await publicationGuard.assertCurrent(authority);
          const request = await createSharedMediaRequest({ artistName,
            evidence: buildRequestEvidence({ appUserId: prepared.appUserId, desiredRelease, snapshotId: prepared.snapshotId, snapshotRevision: prepared.snapshotRevision }),
            expectedReleaseDate: normalizeMetadataReleaseDateForDateColumn(desiredRelease.releaseDate),
            matchedMetadataReleaseGroupId: desiredRelease.metadataReleaseGroupId,
            matchedMetadataReleaseId: desiredRelease.metadataReleaseId,
            musicbrainzReleaseId: desiredRelease.musicbrainzReleaseId ?? null,
            normalizedQuery: buildNormalizedQuery({ artistName, releaseTitle: desiredRelease.releaseTitle ?? desiredRelease.releaseGroupTitle ?? null }),
            notes: null, queryable, releaseTitle: desiredRelease.releaseTitle ?? desiredRelease.releaseGroupTitle ?? null,
            requestKind: 'release', requestState: 'needs_fetch', requestedByUserId: prepared.appUserId, requestedForUserId: prepared.appUserId,
            sourceProvider: null, sourceUrl: null, trackTitle: null,
          });
          await insertSharedMediaRequestEvent({ actorUserId: prepared.appUserId, details: {
            automationSource: 'operator_artist_reconciliation', metadataReleaseGroupId: desiredRelease.metadataReleaseGroupId,
            metadataReleaseId: desiredRelease.metadataReleaseId, snapshotId: prepared.snapshotId, snapshotRevision: prepared.snapshotRevision,
          }, eventType: 'created', mediaRequestId: request.id, queryable });
          await throwIfCancelled({ queryable });
          await publicationGuard.assertCurrent(authority);
          return request;
        });
        if (!mediaRequest) { duplicateSuppressedCount += 1; continue; }
        createdRequestIds.push(mediaRequest.id); createdRequests.push(mediaRequest);
      }
      if (createdRequestIds.length > 0 && typeof reconcileDiscoveryRequests === 'function') await reconcileDiscoveryRequests();
    } catch (error) {
      if (createdRequestIds.length > 0 && typeof reconcileDiscoveryRequests === 'function') {
        try { await reconcileDiscoveryRequests(); } catch { /* Preserve the original publication failure. */ }
      }
      throw error;
    }
    return { createdRequestCount: createdRequestIds.length, createdRequestIds, createdRequests,
      discoveryReconciled: createdRequestIds.length > 0 && typeof reconcileDiscoveryRequests === 'function',
      duplicateSuppressedCount, skippedRequestCount };
  }

  return {
    materializeDesiredReleaseRequests,
  };
}
