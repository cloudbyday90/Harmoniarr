/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createWorkAdmission } from '../work-admission.js';

export const MEDIA_COMMAND_ADMISSION_POLICY = Object.freeze({
  concurrency: 2,
  maxQueued: 16,
  queueTimeoutMs: 15_000,
});

export function createMediaCommandAdmission(options = {}) {
  const admission = createWorkAdmission({ ...MEDIA_COMMAND_ADMISSION_POLICY, ...options,
    makeError: reason => Object.assign(new Error(reason === 'cancelled'
      ? 'Media command was aborted before admission' : 'Media command capacity is temporarily unavailable'),
    { code: reason === 'cancelled' ? 'ABORT_ERR' : 'MEDIA_COMMAND_CAPACITY', reason }),
  });
  return { run: admission.run, getState: () => {
    const { active, queued } = admission.getState(); return { active, queued };
  } };
}
