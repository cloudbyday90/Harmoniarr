/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { Agent, request } from 'node:https';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';
import { createPublicDestinationResolver } from '../network/public-destination-resolver.js';
import { isPublicAddress } from '../network/public-address-policy.js';
import { artworkImageError } from './artwork-image-download-policy.js';

const proxyKeys = ['HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'];

function responseBody(incoming, closed) {
  const reader = Readable.toWeb(incoming, { strategy: { highWaterMark: 65_536, size: chunk => chunk.byteLength } }).getReader();
  void reader.closed.catch(() => {});
  let cancelled = false; let released = false;
  const release = () => { if (!released) { released = true; reader.releaseLock(); } };
  return new ReadableStream({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (cancelled) return;
        if (result.done) { release(); controller.close(); }
        else controller.enqueue(result.value);
      } catch {
        release();
        if (!cancelled) controller.error(artworkImageError('response_invalid'));
      }
    },
    async cancel() {
      cancelled = true; incoming.destroy();
      try { await reader.cancel(); } catch { /* Stream error is already observed. */ }
      await closed; release();
    },
  }, { highWaterMark: 0 });
}

/** Direct HTTPS only. A hop's complete DNS snapshot is its only lookup source. */
export function createArtworkImageTransport({ requestFn = request, env = process.env,
  destinationResolver = createPublicDestinationResolver() } = {}) {
  async function fetchImage(value, { signal, headers = {} } = {}) {
    if (proxyKeys.some(key => Boolean(env[key]))) throw artworkImageError('proxy_refused');
    let url;
    try {
      url = new URL(value);
      if (url.protocol !== 'https:' || url.port || url.username || url.password || isIP(url.hostname.replace(/^\[|\]$/gu, ''))
        || typeof signal?.addEventListener !== 'function') throw new Error();
    } catch { throw artworkImageError('url_refused'); }
    if (signal.aborted) throw artworkImageError('timeout');
    let answers;
    try { answers = await destinationResolver.resolveDestinations({ hostname: url.hostname, signal }); }
    catch (error) {
      throw artworkImageError(error?.code === 'egress_destination_blocked' ? 'destination_blocked' : 'dns_failed',
        { retryable: error?.code !== 'egress_destination_blocked' });
    }
    if (signal.aborted) throw artworkImageError('timeout');
    if (!Array.isArray(answers) || answers.length === 0 || answers.length > 64
      || !Array.from(answers).every(answer => answer && isIP(answer.address) === answer.family && isPublicAddress(answer.address))) {
      throw artworkImageError('destination_blocked');
    }
    // Copy primitives so even an injected resolver cannot mutate a later fallback.
    const snapshot = Object.freeze(answers.map(({ address, family }) => Object.freeze({ address, family })));
    const lookup = (hostname, options, callback) => {
      if (typeof options === 'function') { callback = options; options = {}; }
      if (hostname !== url.hostname || signal.aborted) { callback(artworkImageError('destination_blocked')); return; }
      if (options?.all) callback(null, snapshot.map(answer => ({ ...answer })));
      else callback(null, snapshot[0].address, snapshot[0].family);
    };
    // Never inherit the global agent, proxy settings, dispatcher or socket pool.
    const agent = new Agent({ keepAlive: false, proxyEnv: {} });
    return new Promise((resolve, reject) => {
      let outgoing; let incoming; let delivered = false;
      const retire = () => { agent.destroy(); signal.removeEventListener('abort', abort); };
      const abort = () => { outgoing?.destroy(); incoming?.destroy(); };
      signal.addEventListener('abort', abort, { once: true });
      try {
        outgoing = requestFn(url, { method: 'GET', agent, lookup, family: 0, autoSelectFamily: true,
          autoSelectFamilyAttemptTimeout: 250, servername: url.hostname, rejectUnauthorized: true, signal, maxHeaderSize: 16_384,
          headers: { Accept: 'image/jpeg, image/png, image/webp', 'Accept-Encoding': 'identity', Host: url.host,
            ...(headers['User-Agent'] ? { 'User-Agent': headers['User-Agent'] } : {}) },
        }, response => {
          incoming = response;
          const closed = new Promise(done => { incoming.once('close', () => { retire(); done(); }); });
          incoming.on('error', () => {});
          if (signal.aborted) { incoming.destroy(); reject(artworkImageError('timeout')); return; }
          try {
            const body = responseBody(incoming, closed);
            delivered = true;
            resolve({ status: incoming.statusCode, ok: incoming.statusCode >= 200 && incoming.statusCode < 300,
              headers: new Headers(incoming.headers), body, url: url.href, redirected: false });
          } catch { incoming.destroy(); reject(artworkImageError('response_invalid')); }
        });
        outgoing.on('error', () => {
          if (!delivered) { retire(); reject(artworkImageError(signal.aborted ? 'timeout' : 'transport_failed', { retryable: true })); }
          else incoming?.destroy();
        });
        outgoing.once('close', () => {
          if (!delivered) { retire(); reject(artworkImageError(signal.aborted ? 'timeout' : 'transport_failed', { retryable: true })); }
        });
        if (signal.aborted) abort(); else outgoing.end();
      } catch { abort(); retire(); reject(artworkImageError('transport_failed', { retryable: true })); }
    });
  }
  return { fetchImage };
}
