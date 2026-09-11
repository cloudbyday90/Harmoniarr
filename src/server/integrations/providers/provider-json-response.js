/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { awaitProviderRequest } from '../provider-request-cancellation.js';

function invalidResponse() {
  return Object.assign(new Error('The remote response was not valid bounded JSON.'), { code: 'provider_response_invalid' });
}

export async function readBoundedJsonResponse(response, { maxResponseBytes = 2_000_000, signal = null } = {}) {
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 2_000_000) throw invalidResponse();
  const declared = response.headers.get('content-length');
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxResponseBytes) {
    void response.body?.cancel().catch(() => {});
    throw invalidResponse();
  }
  if (!response.body) throw invalidResponse();
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await awaitProviderRequest(reader.read(), { signal });
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxResponseBytes) throw invalidResponse();
      chunks.push(value);
    }
    let parsed;
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes))); } catch { throw invalidResponse(); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw invalidResponse();
    return parsed;
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
