/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { awaitProviderRequest, createProviderRequestSignal, throwIfProviderRequestAborted,
  waitForProviderRequestDelay } from '../provider-request-cancellation.js';
import { readBoundedProviderJson } from '../bounded-json-response.js';
import { musicBrainzResponseBudget } from './musicbrainz-response-policy.js';

function failure(code, message, details, diagnosticCode) {
  return Object.assign(new Error(message), { code, diagnosticCode,
    details: { retryAfterMs: null, status: null, throttled: false, ...details } });
}

function backoff(attemptNumber, minIntervalMs) {
  return minIntervalMs * (2 ** Math.min(attemptNumber, 4)) + Math.floor(Math.random() * 250);
}

function parseRetryAfterMs(value, nowMs = Date.now()) {
  if (value == null || value === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - nowMs) : null;
}

/** Client owns admission and URL construction; this service owns attempts/body. */
export function createMusicBrainzRequestService({ fetchImpl, sleepImpl, requestTimeoutMs, maxRetries, minIntervalMs, userAgent }) {
  async function requestJson(url, { operation, signal = null }) {
    const maxResponseBytes = musicBrainzResponseBudget(operation);
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      throwIfProviderRequestAborted(signal);
      const requestSignal = createProviderRequestSignal({ signal, timeoutMs: requestTimeoutMs });
      const details = { attempts: attempt + 1, maxRetries, retryable: false };
      let response;
      try {
        response = await awaitProviderRequest(fetchImpl(url, { method: 'GET',
          headers: { Accept: 'application/json', 'User-Agent': userAgent }, redirect: 'error', signal: requestSignal }),
        { signal: requestSignal });
      } catch {
        throwIfProviderRequestAborted(signal);
        if (attempt === maxRetries) throw failure('musicbrainz_unavailable',
          `MusicBrainz ${operation} request failed before receiving a response`, { ...details, retryable: true },
          requestSignal.aborted ? 'timeout' : 'unavailable');
        await waitForProviderRequestDelay(backoff(attempt + 1, minIntervalMs), { signal, sleepImpl });
        continue;
      }

      if (response.ok) {
        try { return await readBoundedProviderJson(response, { maxResponseBytes, signal: requestSignal }); }
        catch {
          throwIfProviderRequestAborted(signal);
          const timedOut = requestSignal.aborted;
          throw failure(timedOut ? 'musicbrainz_unavailable' : 'musicbrainz_invalid_response',
            `MusicBrainz ${operation} response could not be completed`, details, timedOut ? 'timeout' : 'response_invalid');
        }
      }

      // Cancel ignored bodies before a retry. Cleanup cannot replace the known
      // HTTP result, and it shares the same per-attempt deadline.
      try { await awaitProviderRequest(response.body?.cancel(), { signal: requestSignal }); } catch { /* Keep HTTP classification. */ }
      throwIfProviderRequestAborted(signal);
      const status = response.status;
      if (status === 404) throw failure('musicbrainz_not_found', `MusicBrainz ${operation} not found`,
        { ...details, status }, 'not_found');
      const retryable = status === 429 || status >= 500;
      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
      const throttled = status === 429 || status === 503;
      if (!retryable || attempt === maxRetries) throw failure(retryable ? 'musicbrainz_unavailable' : 'musicbrainz_request_failed',
        `MusicBrainz ${operation} request failed with status ${status}`,
        { ...details, retryable, retryAfterMs, status, throttled }, retryable ? 'unavailable' : 'request_rejected');
      await waitForProviderRequestDelay(Math.max(backoff(attempt + 1, minIntervalMs), retryAfterMs ?? 0), { signal, sleepImpl });
    }
  }
  return { requestJson };
}
