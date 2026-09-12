/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../auth.js';
import { recordAuditEvent } from '../audit.js';
import { createActivityEventStore } from '../activity/activity-event-store.js';
import { buildMediaRequestTargetEligibility } from '../media-request-target-eligibility.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { projectRequestLifecycleActivity } from '../../shared/request-lifecycle-activity.js';
import { createLibraryMediaRequestStore } from './library-media-request-store.js';

const cancellableStates = new Set(['needs_fetch', 'needs_review']);

function normalizeText(value, name, maxLength, optional = false) {
  if (optional && (value == null || value === '')) return null;
  if (typeof value !== 'string') throw createApiError(400, 'validation_error', `${name} must be a string`);
  const result = value.trim().replace(/\s+/g, ' ');
  if (!result) throw createApiError(400, 'validation_error', `${name} is required`);
  if (result.length > maxLength) throw createApiError(400, 'validation_error', `${name} must be ${maxLength} characters or fewer`);
  return result;
}

export function createLibraryMediaRequestLifecycleService({
  mediaRequestStore = createLibraryMediaRequestStore(),
  getAppUserById = null,
  activityEventStore = createActivityEventStore(),
  recordAuditEventFn = recordAuditEvent,
  withRequestTransaction = createDatabaseTransactionRunner(),
} = {}) {
  async function transact(work) {
    try { return await withRequestTransaction(work); }
    catch (error) {
      if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) throw error;
      throw createApiError(500, 'media_request_lifecycle_failed', 'Could not save the request change. Refresh requests before trying again.');
    }
  }

  async function loadLockedRequest(mediaRequestId, queryable) {
    await mediaRequestStore.lockMediaRequest({ mediaRequestId, queryable });
    const request = await mediaRequestStore.getMediaRequestById({ mediaRequestId, queryable });
    if (!request) throw createApiError(404, 'media_request_not_found', 'The specified media request could not be found');
    return request;
  }

  async function recordActivity({ actorUserId, mediaRequestId, eventType, queryable }) {
    // The feed reads this table directly. Its safe row commits with the request;
    // optional notification callbacks and the best-effort Activity API are not used.
    await activityEventStore.insertActivityEvent({
      ...projectRequestLifecycleActivity({ actorUserId, entityId: mediaRequestId, eventType }), queryable,
    });
  }

  function auditContext({ actorUserId, mediaRequestId, requestMetadata }) {
    return { actorType: 'app_user', actorUserId, entityId: mediaRequestId, entityType: 'media_request',
      ipAddress: requestMetadata?.ipAddress ?? null, userAgent: requestMetadata?.userAgent ?? null };
  }

  async function reassignMediaRequest({ actorUserId, actorUserRole = null, mediaRequestId,
    newRequestedForUserId, reason, requestMetadata = null }) {
    if (actorUserRole !== 'admin') throw createApiError(403, 'forbidden', 'Only administrators can reassign media requests');
    const normalizedReason = normalizeText(reason, 'reason', 500, true);
    const normalizedTargetId = normalizeText(newRequestedForUserId, 'newRequestedForUserId', 200);
    const targetId = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(normalizedTargetId)
      ? normalizedTargetId.toLowerCase() : normalizedTargetId;
    return transact(async (queryable) => {
      const request = await loadLockedRequest(mediaRequestId, queryable);
      const previousTargetId = request.requestedForUser?.id;
      if (previousTargetId === targetId) throw createApiError(409, 'reassignment_noop', 'The media request is already assigned to the specified user');
      const target = await getAppUserById({ userId: targetId, queryable });
      if (!target) throw createApiError(404, 'app_user_not_found', 'The target user could not be found');
      const canonicalTargetId = target.id;
      if (previousTargetId === canonicalTargetId) throw createApiError(409, 'reassignment_noop', 'The media request is already assigned to the specified user');
      if (typeof canonicalTargetId !== 'string' || !canonicalTargetId) throw new Error('The resolved target must have a persisted identity');
      if (!buildMediaRequestTargetEligibility(target).eligible) throw createApiError(409, 'media_request_target_ineligible', 'The target user is not currently eligible for media requests');
      if (!await mediaRequestStore.updateRequestedForUserId({ mediaRequestId, newRequestedForUserId: canonicalTargetId, queryable })) {
        throw createApiError(404, 'media_request_not_found', 'The specified media request could not be updated');
      }
      await mediaRequestStore.insertMediaRequestEvent({ mediaRequestId, actorUserId, eventType: 'reassigned',
        previousRequestedForUserId: previousTargetId, newRequestedForUserId: canonicalTargetId, reason: normalizedReason,
        details: { artistName: request.artistName, releaseTitle: request.releaseTitle,
          requestKind: request.requestKind, requestState: request.requestState }, queryable });
      await recordAuditEventFn({ ...auditContext({ actorUserId, mediaRequestId, requestMetadata }),
        eventType: 'media_request_reassigned',
        details: { newRequestedForUserId: canonicalTargetId, previousRequestedForUserId: previousTargetId, reason: normalizedReason, requestId: mediaRequestId },
        summary: `Reassigned media request from user ${previousTargetId} to user ${canonicalTargetId}${normalizedReason ? `: ${normalizedReason}` : ''}` }, queryable);
      await recordActivity({ actorUserId, mediaRequestId, eventType: 'request_reassigned', queryable });
      return mediaRequestStore.getMediaRequestById({ mediaRequestId, queryable });
    });
  }

  async function cancelMediaRequest({ actorUserId, actorUserRole = null, mediaRequestId, reason, requestMetadata = null }) {
    const normalizedReason = normalizeText(reason, 'reason', 500, true);
    return transact(async (queryable) => {
      const request = await loadLockedRequest(mediaRequestId, queryable);
      const isOwnRequest = request.requestedForUser?.id === actorUserId || request.requestedByUser?.id === actorUserId;
      if (actorUserRole !== 'admin' && !isOwnRequest) throw createApiError(403, 'forbidden', 'You can only cancel your own requests');
      if (request.requestState === 'cancelled') throw createApiError(409, 'request_already_cancelled', 'This request is already cancelled');
      if (!cancellableStates.has(request.requestState)) throw createApiError(409, 'request_not_cancellable', `Requests in state "${request.requestState}" cannot be cancelled`);
      // Every lifecycle writer locks its subject first. An administrator's
      // cascade then locks children in UUID order, before any state changes.
      // Inspect real children rather than relying on the denormalized count.
      const children = actorUserRole === 'admin'
        ? (await mediaRequestStore.lockFanOutChildren({ parentMediaRequestId: mediaRequestId, queryable }))
          .filter((child) => cancellableStates.has(child.requestState)) : [];
      if (!await mediaRequestStore.updateRequestState({ mediaRequestId, newState: 'cancelled', queryable })) {
        throw createApiError(404, 'media_request_not_found', 'The specified media request could not be updated');
      }
      for (const child of children) {
        if (!await mediaRequestStore.updateRequestState({ mediaRequestId: child.id, newState: 'cancelled', queryable })) {
          throw new Error('A locked child request could not be updated');
        }
        await mediaRequestStore.insertMediaRequestEvent({ actorUserId, mediaRequestId: child.id, eventType: 'cancelled',
          details: { cascadeFromParentId: mediaRequestId, previousState: child.requestState }, reason: normalizedReason, queryable });
      }
      const audit = auditContext({ actorUserId, mediaRequestId, requestMetadata });
      if (children.length) await recordAuditEventFn({ ...audit, eventType: 'media_request_fan_out_cancelled',
        details: { cancelledChildCount: children.length, parentRequestId: mediaRequestId, reason: normalizedReason },
        summary: `Cascade-cancelled ${children.length} fan-out child request${children.length === 1 ? '' : 's'}` }, queryable);
      await mediaRequestStore.insertMediaRequestEvent({ actorUserId, mediaRequestId, eventType: 'cancelled',
        details: { artistName: request.artistName, previousState: request.requestState,
          releaseTitle: request.releaseTitle, requestKind: request.requestKind }, reason: normalizedReason, queryable });
      await recordAuditEventFn({ ...audit, eventType: 'media_request_cancelled',
        details: { previousState: request.requestState, reason: normalizedReason, requestId: mediaRequestId },
        summary: `Cancelled media request${normalizedReason ? `: ${normalizedReason}` : ''}` }, queryable);
      // Preserve the household contract: one parent action, detailed child
      // history behind request authorization, with no additional child Activity.
      await recordActivity({ actorUserId, mediaRequestId, eventType: 'request_cancelled', queryable });
      const cancelled = await mediaRequestStore.getMediaRequestById({ mediaRequestId, queryable });
      return { ...cancelled, cancelledChildCount: children.length };
    });
  }

  return { cancelMediaRequest, reassignMediaRequest };
}
