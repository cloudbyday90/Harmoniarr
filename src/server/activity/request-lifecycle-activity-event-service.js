/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  isRequestLifecycleActivity,
  projectRequestLifecycleActivity,
} from '../../shared/request-lifecycle-activity.js';

export function publishRequestLifecycleActivityEvent({
  recordActivityEventFn,
  actorUserId = null,
  mediaRequestId = null,
  eventType,
} = {}) {
  if (typeof recordActivityEventFn !== 'function' || !isRequestLifecycleActivity(eventType)) return;

  try {
    const event = projectRequestLifecycleActivity({
      actorUserId,
      entityId: mediaRequestId,
      eventType,
    });
    void Promise.resolve(recordActivityEventFn(event)).catch(() => {});
  } catch {
    // Optional household Activity cannot change the result of a successful mutation.
  }
}
