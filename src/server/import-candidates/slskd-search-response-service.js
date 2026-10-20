/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { setTimeout } from 'node:timers/promises';
import { createApiError } from '../auth.js';

function hasResponses(result) {
  return Array.isArray(result?.responses) && result.responses.length > 0;
}

function assertBoundedInteger(value, maximum, name) {
  if (!Number.isInteger(value) || value < 0 || value > maximum) {
    throw new TypeError(`${name} must be an integer between 0 and ${maximum}`);
  }
}

function isPublishedEmptySearch(state) {
  // In slskd 0.26.1 EndedAt and response bodies are persisted together, after
  // the earlier Completed/count update. Completed alone is not publication.
  return state?.isComplete === true
    && typeof state.endedAt === 'string' && Number.isFinite(Date.parse(state.endedAt))
    && state.responseCount === 0 && state.fileCount === 0 && state.lockedFileCount === 0;
}

export function createSlskdSearchResponseService({
  slskdService,
  pollAttempts = 15,
  publicationPollAttempts = 3,
  pollIntervalMs = 1000,
  sleepFn = setTimeout,
} = {}) {
  assertBoundedInteger(pollAttempts, 60, 'pollAttempts');
  assertBoundedInteger(publicationPollAttempts, 10, 'publicationPollAttempts');
  assertBoundedInteger(pollIntervalMs, 10000, 'pollIntervalMs');

  async function waitForSearchResponses({ searchId, assertCurrent = null, searchBinding = null }) {
    const checkCurrent = async () => { if (assertCurrent) await assertCurrent(); };
    async function read(method, input) {
      await checkCurrent();
      const result = await slskdService[method]({ ...input, ...(searchBinding === null ? {} : { searchBinding }) });
      await checkCurrent();
      return result;
    }
    const notReady = () => createApiError(503, 'slskd_search_responses_not_ready',
      'Search results are not available yet. Try checking the search again.');

    let result = await read('getSearchResponses', { searchId });
    if (hasResponses(result)) return result;
    if (typeof slskdService.getSearchState !== 'function') throw notReady();

    let remainingAttempts = pollAttempts;
    let publicationStarted = false;
    let observedResponseCount = false;
    while (remainingAttempts > 0) {
      remainingAttempts -= 1;
      await checkCurrent();
      if (pollIntervalMs > 0) await sleepFn(pollIntervalMs);
      const state = await read('getSearchState', { searchId, includeResponses: true });
      const flags = typeof state?.state === 'string' ? state.state.split(',').map(flag => flag.trim()) : [];
      if (flags.includes('Cancelled') || flags.includes('Errored')) {
        throw createApiError(503, 'slskd_search_failed', 'The provider search did not complete successfully.');
      }
      if (hasResponses(state)) {
        return { searchId: typeof state.id === 'string' && state.id.trim() ? state.id.trim() : searchId, responses: state.responses };
      }
      observedResponseCount ||= state?.responseCount > 0 || state?.fileCount > 0 || state?.lockedFileCount > 0;
      if (observedResponseCount || state?.isComplete === true) {
        result = await read('getSearchResponses', { searchId });
        if (hasResponses(result)) return result;
        if (!observedResponseCount && isPublishedEmptySearch(state)) return result;
      }
      if (!publicationStarted && state?.isComplete === true) {
        publicationStarted = true;
        remainingAttempts = publicationPollAttempts;
      }
    }
    // Queued/running searches and unpublished completed bodies are unavailable,
    // not evidence of a successful zero-result search. Never restart a POST here.
    throw notReady();
  }

  return { waitForSearchResponses };
}
