/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { awaitProviderRequest } from '../provider-request-cancellation.js';
import { readBoundedJsonResponse } from '../providers/provider-json-response.js';
import { maximumFanartDelayMs } from './fanart-request-policy.js';

function failure(code, message, details, diagnosticCode) {
  return Object.assign(new Error(message), { code, diagnosticCode, details });
}

function parseRetryAfterMs(value, nowMs = Date.now()) {
  if (value == null || value === '') return null;
  if (/^\d+$/u.test(value)) return Number(value) * 1000;
  const dateMs = Date.parse(value);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - nowMs) : null;
}

function backoff(attempt) {
  return 1000 * (2 ** Math.min(attempt, 4)) + Math.floor(Math.random() * 250);
}

/** Owns one logical request's attempts and response; the client owns credentials. */
export function createFanartTvRequestService({ fetchImpl, sleepImpl, requestTimeoutMs, maxRetries }) {
  async function requestJson(url, { headers }) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const signal = AbortSignal.timeout(requestTimeoutMs);
      const details = { attempts: attempt + 1, retryable: false, status: null };
      let response;
      try {
        response = await awaitProviderRequest(fetchImpl(url, { method: 'GET', headers, redirect: 'error', signal }), { signal });
      } catch {
        if (attempt === maxRetries) throw failure('fanarttv_unavailable', 'Fanart.tv request failed before receiving a response',
          { ...details, retryable: true }, signal.aborted ? 'timeout' : 'unavailable');
        await sleepImpl(backoff(attempt + 1));
        continue;
      }

      if (response.ok) {
        try { return await readBoundedJsonResponse(response, { signal }); }
        catch {
          throw failure(signal.aborted ? 'fanarttv_unavailable' : 'fanarttv_invalid_response',
            'Fanart.tv response could not be completed', details, signal.aborted ? 'timeout' : 'response_invalid');
        }
      }

      // Ignored error bodies must retire before retry/404 publication. Cleanup
      // shares the attempt deadline and cannot replace the known HTTP result.
      try { await awaitProviderRequest(response.body?.cancel(), { signal }); } catch { /* Keep HTTP classification. */ }
      if (response.status === 404) return null;
      const status = response.status;
      const retryable = status === 429 || status >= 500;
      if (!retryable || attempt === maxRetries) throw failure(retryable ? 'fanarttv_unavailable' : 'fanarttv_request_failed',
        `Fanart.tv request failed with status ${status}`, { ...details, retryable, status },
        retryable ? 'unavailable' : 'request_rejected');
      const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
      // Node turns an out-of-range timer into a near-immediate retry. Refuse the
      // automatic retry instead of shortening a valid, very long Retry-After.
      if (retryAfterMs != null && (!Number.isSafeInteger(retryAfterMs) || retryAfterMs > maximumFanartDelayMs)) {
        throw failure('fanarttv_unavailable', 'Fanart.tv retry cannot be scheduled within the request policy',
          { ...details, retryable: true, status }, 'retry_deferred');
      }
      await sleepImpl(Math.max(backoff(attempt + 1), retryAfterMs ?? 0));
    }
  }
  return { requestJson };
}
