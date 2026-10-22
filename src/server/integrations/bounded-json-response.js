/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { awaitProviderRequest } from './provider-request-cancellation.js';

export function invalidProviderJsonResponse() {
  return Object.assign(new Error('The remote response was not valid bounded JSON.'), { code: 'provider_response_invalid' });
}

/** Counts decoded fetch bytes. Callers own the smaller operation-specific budget. */
export async function readBoundedProviderJson(response, { maxResponseBytes, signal = null } = {}) {
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 8_000_000) {
    throw invalidProviderJsonResponse();
  }
  const declared = response.headers.get('content-length');
  if (declared && /^\d+$/.test(declared) && Number(declared) > maxResponseBytes) {
    void response.body?.cancel().catch(() => {});
    throw invalidProviderJsonResponse();
  }
  if (!response.body) throw invalidProviderJsonResponse();
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await awaitProviderRequest(reader.read(), { signal });
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxResponseBytes) throw invalidProviderJsonResponse();
      chunks.push(value);
    }
    let parsed;
    try { parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, bytes))); }
    catch { throw invalidProviderJsonResponse(); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw invalidProviderJsonResponse();
    return parsed;
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
