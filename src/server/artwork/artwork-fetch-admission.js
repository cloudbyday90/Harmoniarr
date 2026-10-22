/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { createWorkAdmission, isWorkAdmissionError } from '../work-admission.js';

export const ARTWORK_FETCH_CONCURRENCY = 2;
export const ARTWORK_FETCH_BATCH_LIMIT = 50;
export const isArtworkAdmissionError = isWorkAdmissionError;

export function createArtworkFetchAdmission({ concurrency = ARTWORK_FETCH_CONCURRENCY, maxQueued = 32,
  queueTimeoutMs = 15_000, now } = {}) {
  const admission = createWorkAdmission({ concurrency, maxQueued, queueTimeoutMs, now,
    makeError: reason => Object.assign(new Error(reason === 'cancelled'
      ? 'Artwork request was cancelled before admission' : 'Artwork capacity is temporarily unavailable'),
    { code: `artwork_fetch_${reason}`, status: 503 }),
  });
  return { run: admission.run, getState: () => {
    const { active, queued } = admission.getState(); return { active, queued };
  } };
}
