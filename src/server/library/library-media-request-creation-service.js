/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { recordAuditEvent } from '../audit.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { normalizeExternalMediaSource } from './external-media-source-parser.js';
import { createLibraryMediaRequestStore } from './library-media-request-store.js';

function publishOptionalEffect(callback, payload) {
  if (typeof callback !== 'function') return;
  try {
    void Promise.resolve(callback(payload)).catch(() => {});
  } catch {
    // Optional publication cannot change the result of a committed request.
  }
}

export function createLibraryMediaRequestCreationService({
  externalIntakeService = null,
  mediaRequestStore = createLibraryMediaRequestStore(),
  onRequestCreatedFn = null,
  recordActivityEventFn = null,
  recordAuditEventFn = recordAuditEvent,
  withRequestTransaction = createDatabaseTransactionRunner(),
} = {}) {
  async function createRequestFamily({ request, targetUserIds, ineligible = null, requestMetadata = null }) {
    const normalizedSource = request.requestKind === 'external_url'
      && request.requestState === 'needs_fetch' && request.sourceUrl
      ? normalizeExternalMediaSource(request.sourceUrl)
      : null;

    const committed = await withRequestTransaction(async (queryable) => {
      let linkedRequestId = null;
      let evidence = request.evidence;
      if (request.requestState !== 'already_exists' && request.requestKind !== 'external_url') {
        const existing = await mediaRequestStore.findActiveDuplicateRequest({
          artistName: request.artistName,
          excludeRequestedForUserId: targetUserIds[0],
          musicbrainzReleaseId: request.musicbrainzReleaseId,
          queryable,
          releaseTitle: request.releaseTitle,
        });
        if (existing) {
          linkedRequestId = existing.id;
          evidence = {
            ...evidence,
            dedupLinkedToRequestId: existing.id,
            dedupMatchMethod: request.musicbrainzReleaseId ? 'musicbrainz_release_id' : 'artist_title_text',
          };
        }
      }

      const parent = await mediaRequestStore.createMediaRequest({
        ...request,
        evidence,
        linkedRequestId,
        queryable,
        requestedForUserId: targetUserIds[0],
      });
      const children = targetUserIds.length > 1
        ? await mediaRequestStore.createFanOutChildRequests({
          linkedRequestId,
          parentRequest: parent,
          queryable,
          targetUserIds: targetUserIds.slice(1),
        })
        : [];

      if (children.length !== targetUserIds.length - 1) {
        throw new Error('Music request creation did not persist every eligible target');
      }
      if (children.length > 0) {
        await mediaRequestStore.updateFanOutChildCount({
          childCount: children.length,
          mediaRequestId: parent.id,
          queryable,
        });
      }

      const auditContext = {
        actorType: 'app_user',
        actorUserId: request.requestedByUserId,
        entityId: parent.id,
        entityType: 'media_request',
        ipAddress: requestMetadata?.ipAddress ?? null,
        userAgent: requestMetadata?.userAgent ?? null,
      };
      await recordAuditEventFn({
        ...auditContext,
        details: {
          delegated: targetUserIds[0] !== request.requestedByUserId,
          fanOutChildCount: children.length,
          fanOutParentId: null,
          linked: Boolean(linkedRequestId),
          linkedToRequestId: linkedRequestId,
          requestId: parent.id,
          requestKind: parent.requestKind,
          requestState: parent.requestState,
          requestedForUserId: targetUserIds[0],
        },
        eventType: 'media_request_created',
        summary: `Created ${parent.requestKind} music request as ${parent.requestState}${linkedRequestId ? ' (linked to existing request)' : ''}`,
      }, queryable);
      if (children.length > 0) {
        await recordAuditEventFn({
          ...auditContext,
          details: {
            fanOutChildCount: children.length,
            ineligibleCount: ineligible?.length ?? 0,
            parentRequestId: parent.id,
            targetUserCount: targetUserIds.length,
          },
          eventType: 'media_request_fan_out_created',
          summary: `Created fan-out media request for ${targetUserIds.length} users (${children.length} children)`,
        }, queryable);
      }

      // Persist required planning intent on this client. The existing worker can
      // discover it only after COMMIT; no provider execution occurs here.
      if (normalizedSource && externalIntakeService?.queueExternalMediaRequestPlanning) {
        await externalIntakeService.queueExternalMediaRequestPlanning({
          mediaRequestId: parent.id,
          normalizedSource,
          queryable,
          requestMetadata,
          triggerSource: 'request_submit',
          triggeredByUserId: request.requestedByUserId,
        });
      }
      return { children, linked: Boolean(linkedRequestId), parent };
    });

    for (const created of [committed.parent, ...committed.children]) {
      publishOptionalEffect(recordActivityEventFn, {
        actorUserId: request.requestedByUserId,
        entityArtist: request.artistName ?? null,
        entityId: created.id,
        entityTitle: request.releaseTitle ?? request.artistName ?? null,
        entityType: 'media_request',
        eventType: 'request_created',
      });
    }
    publishOptionalEffect(onRequestCreatedFn, {
      actorUserId: request.requestedByUserId,
      artistName: request.artistName ?? null,
      releaseTitle: request.releaseTitle ?? null,
      requestKind: request.requestKind,
    });

    return {
      ...committed.parent,
      fanOutChildCount: committed.children.length,
      linked: committed.linked,
      ...(ineligible === null ? {} : {
        fanOut: {
          childCount: committed.children.length,
          children: committed.children.map((child) => child.id),
          ineligible,
          totalTargets: targetUserIds.length,
        },
      }),
    };
  }

  return { createRequestFamily };
}
