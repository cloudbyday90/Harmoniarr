/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { awaitProviderRequest } from '../provider-request-cancellation.js';
import { classifyProviderHttpError, createProviderRequestError, parseProviderRetryAfter } from './provider-request-error.js';
import { readBoundedJsonResponse } from './provider-json-response.js';

const origins = {
  spotify: new Set(['https://api.spotify.com', 'https://accounts.spotify.com']),
  youtube: new Set(['https://www.googleapis.com', 'https://oauth2.googleapis.com']),
  apple_music: new Set(['https://api.music.apple.com']),
};

export function createProviderJsonRequestService({ provider, fetchFn = globalThis.fetch, requestTimeoutMs = 15000, requestPolicy = {} }) {
  async function requestJson({ url, method = 'GET', headers, body, oauth = false }) {
    const destination = new URL(url);
    if (!origins[provider]?.has(destination.origin) || destination.username || destination.password || destination.hash) throw createProviderRequestError(provider, 'request_rejected');
    const timeoutMs = Number.isSafeInteger(requestTimeoutMs) ? Math.max(1, Math.min(requestTimeoutMs, 60000)) : 15000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const signal = requestPolicy.signal ? AbortSignal.any([controller.signal, requestPolicy.signal]) : controller.signal;
    const maxBytes = Math.min(2_000_000, Math.max(1, requestPolicy.maxResponseBytes ?? 2_000_000));
    try {
      if (signal.aborted) throw createProviderRequestError(provider, 'timeout');
      await requestPolicy.beforeRequest?.();
      if (signal.aborted) throw createProviderRequestError(provider, 'timeout');
      const response = await awaitProviderRequest(fetchFn(destination.toString(), { method, headers, body, signal, redirect: 'error' }), { signal });
      let parsed;
      try { parsed = await readBoundedJsonResponse(response, { maxResponseBytes: maxBytes, signal }); } catch {
        if (response.ok) throw createProviderRequestError(provider, 'response_invalid');
      }
      if (!response.ok) throw classifyProviderHttpError({ provider, status: response.status, body: parsed,
        retryAfterSeconds: parseProviderRetryAfter(response.headers.get('retry-after')), oauth });
      return parsed;
    } catch (error) {
      if (signal.aborted) throw createProviderRequestError(provider, 'timeout');
      if (error?.diagnosticCode) throw createProviderRequestError(provider, error.diagnosticCode, { ...error.details, oauth });
      throw createProviderRequestError(provider, error instanceof RangeError || error instanceof SyntaxError ? 'response_invalid' : 'unavailable');
    } finally {
      clearTimeout(timer);
    }
  }
  return { requestJson };
}
