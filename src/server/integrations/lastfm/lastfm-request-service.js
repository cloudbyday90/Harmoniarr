/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { awaitProviderRequest, createProviderRequestSignal, throwIfProviderRequestAborted,
  waitForProviderRequestDelay } from '../provider-request-cancellation.js';
import { readBoundedJsonResponse } from '../providers/provider-json-response.js';

function failure(kind, { attempts, maxRetries, retryable = false, status = null }) {
  const suffix = kind === 'response_invalid' ? 'invalid_response' : kind === 'request_rejected' ? 'request_failed' : 'unavailable';
  return Object.assign(new Error(`Last.fm similar artists request could not be completed (${kind}).`), {
    code: `lastfm_${suffix}`, diagnosticCode: kind,
    details: { attempts, maxRetries, retryable,
      status: Number.isInteger(status) && status >= 100 && status <= 599 ? status : null },
  });
}

function backoff(attemptNumber, minIntervalMs) {
  return minIntervalMs * (2 ** Math.min(attemptNumber, 4)) + Math.floor(Math.random() * 250);
}

/** Client owns serial admission; this service owns one request's attempts and response. */
export function createLastFmRequestService({ fetchImpl, sleepImpl, requestTimeoutMs, maxRetries, minIntervalMs }) {
  async function requestJson(url, { signal = null } = {}) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      throwIfProviderRequestAborted(signal);
      const requestSignal = createProviderRequestSignal({ signal, timeoutMs: requestTimeoutMs });
      const details = { attempts: attempt + 1, maxRetries };
      let response;
      try {
        response = await awaitProviderRequest(fetchImpl(url, { method: 'GET', headers: { Accept: 'application/json' },
          redirect: 'error', signal: requestSignal }), { signal: requestSignal });
      } catch {
        throwIfProviderRequestAborted(signal);
        if (attempt === maxRetries) throw failure(requestSignal.aborted ? 'timeout' : 'unavailable', { ...details, retryable: true });
        await waitForProviderRequestDelay(backoff(attempt + 1, minIntervalMs), { signal, sleepImpl });
        continue;
      }

      if (response.ok) {
        try { return await readBoundedJsonResponse(response, { signal: requestSignal }); }
        catch {
          throwIfProviderRequestAborted(signal);
          throw failure(requestSignal.aborted ? 'timeout' : 'response_invalid', details);
        }
      }

      // Ignored error bodies must not retain sockets across retries. Cleanup has
      // the same deadline; its failure must not replace the known HTTP status.
      try { await awaitProviderRequest(response.body?.cancel(), { signal: requestSignal }); } catch { /* Keep HTTP classification. */ }
      throwIfProviderRequestAborted(signal);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxRetries) throw failure(retryable ? 'unavailable' : 'request_rejected',
        { ...details, retryable, status: response.status });
      await waitForProviderRequestDelay(backoff(attempt + 1, minIntervalMs), { signal, sleepImpl });
    }
  }
  return { requestJson };
}
