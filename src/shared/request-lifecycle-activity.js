/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const requestLifecycleActivityTypes = Object.freeze(['request_cancelled', 'request_reassigned']);

export function isRequestLifecycleActivity(eventType) {
  return requestLifecycleActivityTypes.includes(eventType);
}

export function projectRequestLifecycleActivity(event) {
  if (!isRequestLifecycleActivity(event?.eventType)) return event;
  // The household feed is broader than the authorized request-history audience.
  return {
    id: event.id ?? null,
    eventType: event.eventType,
    actorUserId: event.actorUserId ?? null,
    entityType: 'media_request',
    entityId: event.entityId ?? null,
    entityTitle: null,
    entityArtist: null,
    extraPayload: null,
    occurredAt: event.occurredAt ?? null,
  };
}

export function getRequestLifecycleActivityLabel(eventType) {
  if (eventType === 'request_cancelled') return 'Music request cancelled';
  if (eventType === 'request_reassigned') return 'Music request reassigned';
  return null;
}
