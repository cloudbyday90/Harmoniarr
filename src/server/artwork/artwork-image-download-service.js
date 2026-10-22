/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { awaitProviderRequest } from '../integrations/provider-request-cancellation.js';
import { assertArtworkRasterSignature } from './artwork-image-content-policy.js';
import { createArtworkImageTransport } from './artwork-image-transport.js';
import { admitArtworkImageUrl, artworkImageByteLimit, artworkImageError, artworkImageRetryAfter, isArtworkImageError } from './artwork-image-download-policy.js';

const redirects = new Set([301, 302, 303, 307, 308]);
// The cancellation helper can refuse an already-aborted signal before attaching
// a handler. Observe cleanup rejection immediately while preserving its result.
function observed(promise) { void promise?.catch(() => {}); return promise; }

export function createArtworkImageDownloadService({ fetchImpl = createArtworkImageTransport().fetchImage, requestTimeoutMs = 15000 } = {}) {
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 1 || requestTimeoutMs > 2_147_483_647) {
    throw artworkImageError('policy_invalid');
  }

  async function downloadImage(value, { sourceProvider, limits, userAgent } = {}) {
    let url = admitArtworkImageUrl(value, sourceProvider);
    const maxBytes = artworkImageByteLimit(limits);
    const controller = new AbortController();
    const { signal } = controller;
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs); timer.unref?.();
    let response;
    try {
      for (let hop = 0; ; hop++) {
        try {
          response = await awaitProviderRequest(fetchImpl(url, { method: 'GET', redirect: 'manual', signal,
            credentials: 'omit', referrerPolicy: 'no-referrer',
            headers: { Accept: 'image/jpeg, image/png, image/webp', 'Accept-Encoding': 'identity', ...(userAgent ? { 'User-Agent': userAgent } : {}) },
          }), { signal });
        } catch (error) {
          if (isArtworkImageError(error)) throw error;
          throw artworkImageError(signal.aborted ? 'timeout' : 'transport_failed', { retryable: true });
        }
        if (response.redirected || (response.url && response.url !== url.href)) throw artworkImageError('url_refused');
        if (redirects.has(response.status)) {
          if (sourceProvider !== 'coverArtArchive' || hop >= 3) throw artworkImageError('redirect_refused');
          const next = admitArtworkImageUrl(response.headers.get('location'), sourceProvider, { base: url, redirect: true });
          await awaitProviderRequest(observed(response.body?.cancel()), { signal }); response = null;
          url = next; continue;
        }
        if (!response.ok) {
          const { status } = response;
          const retryable = status === 429 || status >= 500;
          const retryAfterMs = artworkImageRetryAfter(response.headers.get('retry-after'));
          // Preserve the known HTTP result even when body cleanup fails.
          try { await awaitProviderRequest(observed(response.body?.cancel()), { signal }); } catch { /* Deadline still owns the request. */ }
          response = null;
          if (status === 404 || (status === 400 && sourceProvider === 'coverArtArchive')) return null;
          const deferred = retryAfterMs !== null && (!Number.isSafeInteger(retryAfterMs) || retryAfterMs > 2_147_483_647);
          throw artworkImageError(deferred ? 'retry_deferred' : 'http_rejected', { status, retryable, retryAfterMs: deferred ? null : retryAfterMs });
        }
        const encoding = response.headers.get('content-encoding')?.trim().toLowerCase();
        if (encoding && encoding !== 'identity') throw artworkImageError('encoding_refused');
        const declared = response.headers.get('content-length');
        if (declared && (!/^\d+$/u.test(declared) || Number(declared) > maxBytes)) throw artworkImageError('body_too_large');
        if (!response.body) throw artworkImageError('response_invalid');
        const reader = response.body.getReader();
        const chunks = []; let bytes = 0;
        try {
          while (true) {
            const { done, value: chunk } = await awaitProviderRequest(reader.read(), { signal });
            if (done) break;
            bytes += chunk.byteLength;
            if (bytes > maxBytes) throw artworkImageError('body_too_large');
            chunks.push(chunk);
          }
        } finally {
          try { await awaitProviderRequest(observed(reader.cancel()), { signal }); } catch { /* Abort below also retires native fetch. */ }
          reader.releaseLock();
        }
        const buffer = Buffer.concat(chunks, bytes);
        let contentType;
        try { contentType = assertArtworkRasterSignature(buffer); } catch { throw artworkImageError('format_refused'); }
        return { buffer, sourceUrl: url.href, contentType };
      }
    } catch (error) {
      if (signal.aborted) throw artworkImageError('timeout', { retryable: true });
      if (isArtworkImageError(error)) throw error;
      throw artworkImageError('response_invalid');
    } finally {
      // Retire every ignored body and abort all hops, including injected fetches
      // that never resolve. The one timer covers admission through the last byte.
      try { await awaitProviderRequest(observed(response?.body && !response.body.locked ? response.body.cancel() : undefined), { signal }); } catch { /* Do not replace approved diagnostics. */ }
      controller.abort(); clearTimeout(timer);
    }
  }

  async function downloadImageBuffer(url, options) { return (await downloadImage(url, options))?.buffer ?? null; }
  return { downloadImage, downloadImageBuffer };
}
