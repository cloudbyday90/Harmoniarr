/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createProviderHttpService } from './provider-http-service.js';
import { createFetchProviderJsonRequestService } from './provider-fetch-json-request-service.js';

export function createProviderJsonRequestService({ provider, fetchFn = globalThis.fetch, requestTimeoutMs = 15000, requestPolicy = {}, providerHttpService } = {}) {
  if (provider === 'apple_music') return createFetchProviderJsonRequestService({ provider, fetchFn, requestTimeoutMs, requestPolicy });
  const owner = providerHttpService ?? createProviderHttpService({ fetchFn });
  function send(input, empty) {
    const timeoutMs = Number.isSafeInteger(requestTimeoutMs) ? Math.max(1, Math.min(requestTimeoutMs, 60000)) : 15000;
    return owner.request({ ...input, provider, empty, maxBytes: Math.min(2_000_000, Math.max(1, requestPolicy.maxResponseBytes ?? 2_000_000)),
      timeoutMs, signal: requestPolicy.signal, beforeRequest: requestPolicy.beforeRequest });
  }
  return { requestJson: input => send(input, false), requestEmpty: input => send(input, true), close: owner.close, waitForDrain: owner.waitForDrain, getRequestState: owner.getState };
}
