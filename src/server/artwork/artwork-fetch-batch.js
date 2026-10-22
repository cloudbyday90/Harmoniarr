/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { ARTWORK_FETCH_BATCH_LIMIT, ARTWORK_FETCH_CONCURRENCY, isArtworkAdmissionError } from './artwork-fetch-admission.js';
import { isArtworkWorkerError } from './artwork-worker-protocol.js';
import { normalizeArtworkFetchRequest } from './artwork-fetch-request.js';

/** Lazy bounded producers; admission errors escape only after every worker drains. */
export async function resolveArtworkFetchBatch(requests, { resolveArtwork, emptyResult, signal }) {
  if (!Array.isArray(requests) || requests.length > ARTWORK_FETCH_BATCH_LIMIT) {
    throw Object.assign(new Error('Artwork batch must contain at most 50 items'), { status: 400, code: 'validation_error' });
  }
  const inputs = Array.from(requests, normalizeArtworkFetchRequest);
  const results = {};
  let index = 0; let failure;
  async function worker() {
    while (!failure && index < inputs.length) {
      const input = inputs[index++];
      const key = `${input.ownerType}:${input.ownerId}:${input.artworkRole}`;
      try { results[key] = await resolveArtwork({ ...input, signal }); }
      catch (error) {
        if (isArtworkAdmissionError(error) || isArtworkWorkerError(error)) failure ??= error;
        else results[key] = { ...emptyResult };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(ARTWORK_FETCH_CONCURRENCY, inputs.length) }, worker));
  if (failure) throw failure;
  return results;
}
