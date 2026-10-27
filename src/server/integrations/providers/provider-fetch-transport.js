/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { providerTransportError } from './provider-http-policy.js';

/** Explicit injected-fetch seam: await fetch settlement and cancellation, not native-close proof. */
export function createProviderFetchTransport(fetchFn) {
  return { kind: 'injected-fetch', startRequest(url, { method, headers, fetchBody, maxBytes, signal, check }) {
    let safe = true, reader, cancellation;
    const cancel = () => {
      if (reader) { cancellation ??= reader.cancel(); cancellation.catch(() => {}); }
    };
    const result = Promise.resolve().then(async () => {
      let response;
      try {
        response = await fetchFn(url, { method, headers, body: fetchBody, signal, redirect: 'error' });
        if (response.body) reader = response.body.getReader();
        signal.addEventListener('abort', cancel, { once: true }); if (signal.aborted) cancel(); check();
        const status = response.status, limit = status >= 400 ? Math.min(maxBytes, 4096) : maxBytes;
        if (status >= 300 && status < 400) throw providerTransportError('redirect');
        const chunks = []; let bytes = 0;
        try {
          const length = response.headers.get('content-length');
          if (length && (!/^\d+$/u.test(length) || Number(length) > limit)) throw providerTransportError('oversized');
          if (!reader) return { status, headers: response.headers, body: Buffer.alloc(0) };
          while (true) {
            const chunk = await reader.read(); check(); if (chunk.done) break;
            bytes += chunk.value.byteLength; if (bytes > limit) throw providerTransportError('oversized'); chunks.push(chunk.value);
          }
          return { status, headers: response.headers, body: Buffer.concat(chunks, bytes) };
        } catch (error) {
          if (status >= 400 && !signal.aborted) return { status, headers: response.headers, body: Buffer.alloc(0) };
          throw signal.aborted || error?.transportFailure ? error : providerTransportError('invalid');
        }
      } finally {
        signal.removeEventListener('abort', cancel);
        if (reader) {
          try { cancel(); await cancellation; }
          catch { safe = false; }
          finally { try { reader.releaseLock(); } catch { safe = false; } }
        }
      }
    });
    return { result, drained: result.then(() => safe, () => safe) };
  } };
}
