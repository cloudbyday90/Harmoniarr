/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createWorkAdmission } from '../work-admission.js';

export function createArtworkIngestionAdmission({ concurrency = 2, maxQueued = 4,
  maxQueuedBytes = 32 * 1024 * 1024, queueTimeoutMs = 15_000, now } = {}) {
  const admission = createWorkAdmission({ concurrency, maxQueued, maxQueuedWeight: maxQueuedBytes, queueTimeoutMs, now,
    makeError: reason => Object.assign(new Error(reason === 'cancelled'
      ? 'Artwork ingestion was cancelled before admission' : 'Artwork ingestion capacity is temporarily unavailable'),
    { status: 503, code: `artwork_ingestion_${reason}` }),
  });
  return { run: admission.run, getState: () => {
    const { active, queued, queuedWeight } = admission.getState(); return { active, queued, queuedBytes: queuedWeight };
  } };
}
