/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createAppUserService } from '../../src/server/app-user-service.js';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';
import { normalizeExternalMediaSource } from '../../src/server/library/external-media-source-parser.js';
import { createLibraryExternalIntakeRunStore } from '../../src/server/library/library-external-intake-run-store.js';
import { createLibraryExternalRequestCollectionIntakeService } from '../../src/server/library/library-external-request-collection-intake-service.js';
import { createLibraryExternalRequestCollectionIntakeStore } from '../../src/server/library/library-external-request-collection-intake-store.js';
import { createLibraryExternalRequestCollectionReviewService } from '../../src/server/library/library-external-request-collection-review-service.js';
import { createLibraryExternalRequestCollectionReviewStore } from '../../src/server/library/library-external-request-collection-review-store.js';
import { createLibraryExternalRequestDiscoveryRunStore } from '../../src/server/library/library-external-request-discovery-run-store.js';
import { createLibraryExternalRequestReviewService } from '../../src/server/library/library-external-request-review-service.js';
import { createLibraryExternalRequestReviewStore } from '../../src/server/library/library-external-request-review-store.js';
import { createLibraryMediaRequestStore } from '../../src/server/library/library-media-request-store.js';
import { createLibraryProviderIngestExecutionRunStore } from '../../src/server/library/library-provider-ingest-execution-run-store.js';
import { createLibraryProviderIngestRequestStore } from '../../src/server/library/library-provider-ingest-request-store.js';

const sourceUrl = 'https://open.spotify.com/playlist/recoveryfixture';
const albumIds = ['recoveryalbumone', 'recoveryalbumtwo', 'recoveryalbumthree'];

function album(id) {
  return {
    id, name: `Recovery album ${albumIds.indexOf(id) + 1}`, type: 'album', album_type: 'album',
    artists: [{ id: 'recoveryartist', name: 'Recovery fixture artist' }],
    release_date: '2026-01-01', total_tracks: 1,
    tracks: { items: [{ id: `track${id}`, name: 'Recovery fixture track', type: 'track' }], next: null },
  };
}

// Only local, predetermined provider responses are available. This composition
// never resolves saved credentials, starts workers, or calls an HTTP transport.
export function createRequestRecoveryServices({ getPoolFn, allowFirstPage = true }) {
  const calls = { pageOffsets: [], albumIds: [], snapshots: 0 };
  const source = normalizeExternalMediaSource(sourceUrl);
  const dependencies = { getPoolFn };
  const withTransaction = createDatabaseTransactionRunner(dependencies);
  const mediaRequestStore = createLibraryMediaRequestStore(dependencies);
  const reviewStore = createLibraryExternalRequestReviewStore(dependencies);
  const executionRunStore = createLibraryProviderIngestExecutionRunStore(dependencies);
  const planningRunStore = createLibraryExternalIntakeRunStore(dependencies);
  const getAppUserById = createAppUserService(dependencies).getAppUserById;
  const collectionIntakeService = createLibraryExternalRequestCollectionIntakeService({
    collectionStore: createLibraryExternalRequestCollectionIntakeStore(dependencies),
    mediaRequestStore, getAppUserById, withTransaction,
    getNow: () => new Date('2026-09-11T12:00:00.000Z'),
    resolveProviderClients: () => ({ spotify: {
      async getPlaylistSnapshot(id) {
        if (id !== source.sourceIdentifier) throw new Error('Unexpected recovery fixture collection');
        calls.snapshots += 1;
        return { id, snapshot_id: 'recovery-snapshot-one' };
      },
      async getPlaylistItems(id, { offset }) {
        if (id !== source.sourceIdentifier || ![0, 2].includes(offset) || (!allowFirstPage && offset === 0)) {
          throw new Error('Recovery attempted an unexpected provider page');
        }
        calls.pageOffsets.push(offset);
        const ids = offset === 0 ? albumIds.slice(0, 2) : albumIds.slice(2);
        return {
          items: ids.map((albumId) => ({ item: {
            id: `track${albumId}`, type: 'track', name: 'Recovery fixture track', album: album(albumId),
          } })),
          offset, limit: 100, total: 3,
          next: offset === 0 ? 'https://api.spotify.com/v1/playlists/recoveryfixture/items?offset=2&limit=100' : null,
        };
      },
      async getAlbum(id) {
        if (!albumIds.includes(id)) throw new Error('Unexpected recovery fixture album');
        calls.albumIds.push(id);
        return album(id);
      },
    } }),
  });
  const collectionReviewService = createLibraryExternalRequestCollectionReviewService({
    collectionReviewStore: createLibraryExternalRequestCollectionReviewStore(dependencies),
    collectionIntakeService, reviewStore, mediaRequestStore, getAppUserById,
    executionRunStore, planningRunStore, withTransaction,
  });
  const reviewService = createLibraryExternalRequestReviewService({
    reviewStore, mediaRequestStore, executionRunStore, planningRunStore, getAppUserById, withTransaction,
    providerIngestRequestStore: createLibraryProviderIngestRequestStore(dependencies),
    discoveryRunStore: createLibraryExternalRequestDiscoveryRunStore(dependencies),
    collectionReviewService,
  });

  async function completePreparationRun({ runId, mediaRequestId }) {
    await executionRunStore.markRunCompleted({
      runId, summary: { mediaRequestId, sourceProvider: source.provider, triggerSource: 'recovery_rehearsal' },
    });
  }

  return {
    albumIds, calls, collectionIntakeService, collectionReviewService,
    completePreparationRun, mediaRequestStore, reviewService, source,
  };
}
