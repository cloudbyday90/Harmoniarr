/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createWorkAdmission } from '../work-admission.js';
import { projectArtworkAdmissionSnapshot } from '../../shared/artwork-admission-diagnostics.js';
import { ARTWORK_ACTIVE_MEMORY_BUDGET, initialArtworkMemoryReservation, decodedArtworkMemoryReservation } from './artwork-memory-reservation.js';

export function createArtworkIngestionAdmission({ concurrency = 2, maxQueued = 4,
  maxQueuedBytes = 32 * 1024 * 1024, queueTimeoutMs = 15_000, memoryBudgetBytes = ARTWORK_ACTIVE_MEMORY_BUDGET, now } = {}) {
  const admission = createWorkAdmission({ concurrency, maxQueued, maxQueuedWeight: maxQueuedBytes, maxActiveWeight: memoryBudgetBytes, queueTimeoutMs, now,
    makeError: reason => Object.assign(new Error(reason === 'cancelled'
      ? 'Artwork ingestion was cancelled before admission' : 'Artwork ingestion capacity is temporarily unavailable'),
    { status: 503, code: `artwork_ingestion_${reason}` }),
  });
  return { run: (task, { inputBytes = 100 * 1024 ** 2, ...options } = {}) => admission.run(reservation => task({
    onMetadata: (metadata, actualInputBytes = inputBytes) => {
      if (actualInputBytes > inputBytes) throw new TypeError('Artwork input exceeds its reserved size');
      reservation.shrinkTo(decodedArtworkMemoryReservation(metadata, actualInputBytes));
    },
  }), { ...options, activeWeight: initialArtworkMemoryReservation(inputBytes) }),
  getSnapshot: () => {
    const state = admission.getState();
    return projectArtworkAdmissionSnapshot({ active: state.active, queued: state.queued, queuedInputBytes: state.queuedWeight,
      reservedBytes: state.activeWeight, budgetBytes: memoryBudgetBytes, concurrencyLimit: concurrency,
      queueLimit: maxQueued, queuedInputLimitBytes: maxQueuedBytes, queueTimeoutMs });
  },
  getMemoryState: () => ({ reservedBytes: admission.getState().activeWeight, budgetBytes: memoryBudgetBytes }), getState: () => {
    const { active, queued, queuedWeight } = admission.getState(); return { active, queued, queuedBytes: queuedWeight };
  } };
}
