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
import { createLibraryMediaRequestStore } from './library-media-request-store.js';
import { createLibraryProviderIngestRequestStore } from './library-provider-ingest-request-store.js';
import { createLibraryProviderIngestExecutionRunStore } from './library-provider-ingest-execution-run-store.js';
import {
  dedupeProviderIngestRequests,
  deriveAppleMusicPlaylistExpansionRequests,
  deriveSpotifyPlaylistExpansionRequests,
  deriveYouTubePlaylistExpansionRequests,
  normalizePlaylistExpansionPolicy,
} from './playlist-expansion-policy-service.js';

function deriveSpotifyArtistAlbumsRequests({ mediaRequestId, pageData }) {
  const items = pageData?.items ?? [];
  const derivedRequests = items
    .filter((album) => album?.id && album?.album_type !== 'compilation')
    .map((album) => ({
      canonicalUrl: `https://open.spotify.com/album/${album.id}`,
      evidence: { albumId: album.id, albumName: album.name ?? null, albumType: album.album_type ?? null, releaseDate: album.release_date ?? null },
      ingestTargetType: 'release',
      mediaRequestId,
      pageNumber: 1,
      pageCursor: null,
      sourceIdentifier: album.id,
      sourceProvider: 'spotify',
      sourceResourceType: 'release',
      status: 'planned',
    }));

  return { derivedRequests, nextPageCursor: pageData?.next ?? null };
}

export function createLibraryExternalIntakeService({
  createOperationRun,
  getActiveRunByMediaRequestId,
  getNow = () => new Date(),
  mediaRequestStore = createLibraryMediaRequestStore(),
  recordAuditEventFn = recordAuditEvent,
} = {}) {
  async function queueExternalMediaRequestPlanning({ mediaRequestId, normalizedSource, requestMetadata = {}, triggerSource = 'request_submit', triggeredByUserId = null }) {
    const existingRun = await getActiveRunByMediaRequestId(mediaRequestId);
    if (existingRun) {
      return { accepted: true, reusedExistingRun: true, run: existingRun };
    }

    const run = await createOperationRun({
      canonicalUrl: normalizedSource.canonicalUrl,
      mediaRequestId,
      resourceType: normalizedSource.resourceType,
      sourceIdentifier: normalizedSource.sourceIdentifier,
      sourceProvider: normalizedSource.provider,
      status: 'pending',
      triggerSource,
      triggeredByUserId,
    });

    await mediaRequestStore.mergeMediaRequestEvidence({
      evidencePatch: {
        providerAutomation: {
          operationRunId: run.id,
          queuedAt: getNow().toISOString(),
          status: 'queued',
        },
      },
      mediaRequestId,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'app_user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        canonicalUrl: normalizedSource.canonicalUrl,
        mediaRequestId,
        operationRunId: run.id,
        sourceProvider: normalizedSource.provider,
        triggerSource,
      },
      entityId: mediaRequestId,
      entityType: 'media_request',
      eventType: 'library_external_intake_planning_queued',
      ipAddress: requestMetadata.ipAddress ?? null,
      summary: 'External provider intake planning queued',
      userAgent: requestMetadata.userAgent ?? null,
    });

    return { accepted: true, reusedExistingRun: false, run };
  }

  return {
    queueExternalMediaRequestPlanning,
  };
}

export function createLibraryProviderIngestExecutionService({
  executionRunStore = createLibraryProviderIngestExecutionRunStore(),
  getNow = () => new Date(),
  mediaRequestStore = createLibraryMediaRequestStore(),
  providerIngestRequestStore = createLibraryProviderIngestRequestStore(),
  recordAuditEventFn = recordAuditEvent,
  resolveProviderClients = () => ({}),
} = {}) {
  async function queueExternalMediaRequestExecution({ mediaRequestId, canonicalUrl, resourceType, sourceIdentifier, sourceProvider, triggerSource = 'planning_complete', triggeredByUserId = null } = {}) {
    const existingRun = await executionRunStore.getActiveRunByMediaRequestId(mediaRequestId);
    if (existingRun) {
      return { accepted: true, reusedExistingRun: true, run: existingRun };
    }

    const run = await executionRunStore.createOperationRun({
      canonicalUrl,
      mediaRequestId,
      resourceType,
      sourceIdentifier,
      sourceProvider,
      status: 'pending',
      triggerSource,
      triggeredByUserId,
    });

    return { accepted: true, reusedExistingRun: false, run };
  }

  async function executeProviderIngestRequests({ mediaRequestId, operationRunId = null, triggerSource = 'planning_complete', triggeredByUserId = null } = {}) {
    const plannedRows = await providerIngestRequestStore.listPlannedProviderIngestRequests({ mediaRequestId });
    if (plannedRows.length === 0) {
      return { executedCount: 0, failedCount: 0, mediaRequestId };
    }

    const clients = await resolveProviderClients();
    const settings = clients.settings ?? {};
    const playlistExpansionPolicy = normalizePlaylistExpansionPolicy(settings.playlistExpansionPolicy);
    const storefront = settings.appleMusicStorefront ?? 'us';

    let executedCount = 0;
    let failedCount = 0;
    const derivedIngestRequests = [];

    for (const row of plannedRows) {
      try {
        let pageData = null;
        let nextPageCursor = null;
        let newDerivedRequests = [];

        if (row.sourceProvider === 'spotify') {
          const spotifyClient = clients.spotify;
          if (!spotifyClient) {
            throw new Error('Spotify client not configured');
          }

          if (row.ingestTargetType === 'playlist_page') {
            const offsetParam = row.pageCursor ? Number.parseInt(row.pageCursor, 10) : 0;
            pageData = await spotifyClient.getPlaylistItems(row.sourceIdentifier, { offset: offsetParam });
            const derived = deriveSpotifyPlaylistExpansionRequests({ mediaRequestId, pageData, playlistExpansionPolicy, row });
            newDerivedRequests = derived.derivedRequests;
            nextPageCursor = derived.nextPageCursor;
          } else if (row.ingestTargetType === 'artist') {
            const offsetParam = row.pageCursor ? Number.parseInt(row.pageCursor, 10) : 0;
            pageData = await spotifyClient.getArtistAlbums(row.sourceIdentifier, { offset: offsetParam });
            const derived = deriveSpotifyArtistAlbumsRequests({ mediaRequestId, pageData });
            newDerivedRequests = derived.derivedRequests;
            nextPageCursor = derived.nextPageCursor;
          } else if (row.ingestTargetType === 'release') {
            pageData = await spotifyClient.getAlbum(row.sourceIdentifier);
          } else if (row.ingestTargetType === 'track') {
            pageData = await spotifyClient.getTrack(row.sourceIdentifier);
          }
        } else if (row.sourceProvider === 'youtube') {
          const youtubeClient = clients.youtube;
          if (!youtubeClient) {
            throw new Error('YouTube client not configured');
          }

          if (row.ingestTargetType === 'playlist_page') {
            pageData = await youtubeClient.listPlaylistItems(row.sourceIdentifier, { pageToken: row.pageCursor });
            const derived = deriveYouTubePlaylistExpansionRequests({ mediaRequestId, pageData, row });
            newDerivedRequests = derived.derivedRequests;
            nextPageCursor = derived.nextPageCursor;
          } else if (row.ingestTargetType === 'video') {
            const result = await youtubeClient.getVideos(row.sourceIdentifier);
            pageData = result?.items?.[0] ?? null;
          }
        } else if (row.sourceProvider === 'apple_music') {
          const appleMusicClient = clients.appleMusic;
          if (!appleMusicClient) {
            throw new Error('Apple Music client not configured');
          }

          if (row.ingestTargetType === 'playlist_page') {
            const offsetParam = row.pageCursor ? Number.parseInt(row.pageCursor, 10) : 0;
            pageData = await appleMusicClient.getCatalogPlaylist(storefront, row.sourceIdentifier, { offset: offsetParam });
            const derived = deriveAppleMusicPlaylistExpansionRequests({ mediaRequestId, pageData, playlistExpansionPolicy, row, storefront });
            newDerivedRequests = derived.derivedRequests;
            nextPageCursor = derived.nextPageCursor;
          } else if (row.ingestTargetType === 'artist') {
            pageData = await appleMusicClient.getCatalogArtist(storefront, row.sourceIdentifier);
          } else if (row.ingestTargetType === 'release') {
            pageData = await appleMusicClient.getCatalogAlbum(storefront, row.sourceIdentifier);
          } else if (row.ingestTargetType === 'track') {
            pageData = await appleMusicClient.getCatalogSong(storefront, row.sourceIdentifier);
          }
        }

        // Persist raw provider response as evidence on the row.
        await providerIngestRequestStore.updateProviderIngestRequestStatus({
          evidence: { fetchedAt: getNow().toISOString(), response: pageData },
          id: row.id,
          pageCursor: nextPageCursor ?? undefined,
          status: 'completed',
        });

        derivedIngestRequests.push(...newDerivedRequests);
        executedCount++;
      } catch (error) {
        await providerIngestRequestStore.updateProviderIngestRequestStatus({
          evidence: { errorCode: error.code ?? 'unknown_error', errorMessage: error.message, failedAt: getNow().toISOString() },
          id: row.id,
          status: 'failed',
        });

        failedCount++;
      }
    }

    // Persist any derived ingest requests (e.g. album rows from a playlist page).
    let insertedDerived = [];
    if (derivedIngestRequests.length > 0) {
      insertedDerived = await providerIngestRequestStore.insertProviderIngestRequests({
        providerIngestRequests: dedupeProviderIngestRequests(derivedIngestRequests),
      });
    }

    const executedAt = getNow().toISOString();
    await mediaRequestStore.mergeMediaRequestEvidence({
      evidencePatch: {
        providerAutomation: {
          derivedIngestRequestCount: insertedDerived.length,
          executedAt,
          executedCount,
          failedCount,
          operationRunId,
          status: failedCount === 0 ? 'executed' : 'executed_with_failures',
          triggerSource,
        },
      },
      mediaRequestId,
    });

    await recordAuditEventFn({
      actorType: triggeredByUserId ? 'app_user' : 'system',
      actorUserId: triggeredByUserId,
      details: {
        derivedIngestRequestCount: insertedDerived.length,
        executedCount,
        failedCount,
        mediaRequestId,
        operationRunId,
        triggerSource,
      },
      entityId: mediaRequestId,
      entityType: 'media_request',
      eventType: 'provider_ingest_requests_executed',
      summary: `Executed ${executedCount} provider ingest request${executedCount === 1 ? '' : 's'}`,
    });

    return {
      derivedIngestRequests: insertedDerived,
      executedCount,
      failedCount,
      mediaRequestId,
    };
  }

  return {
    executeProviderIngestRequests,
    queueExternalMediaRequestExecution,
  };
}
