/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { request } from 'node:https';
import { performance } from 'node:perf_hooks';
import { isIP } from 'node:net';
import { PUSH_TRANSPORT_TIMEOUT_MS } from './push-delivery-budget.js';
import { parsePushEndpoint } from './push-endpoint-policy.js';
import { createPushDestinationResolver } from './push-destination-resolver.js';
import { isPublicPushAddress } from './push-public-address-policy.js';

const failures = Object.freeze({ timeout: 'Push transport deadline exceeded',
  destination_blocked: 'Push transport destination is not permitted',
  response_too_large: 'Push transport response exceeded its limit',
  request_failed: 'Push transport request failed', invalid_request: 'Push transport request is invalid' });

export function createPushTransportError(reason) {
  const code = Object.hasOwn(failures, reason) ? reason : 'request_failed';
  return Object.assign(new Error(failures[code]), { code: `push_transport_${code}` });
}

/** Sends generated encrypted bytes with a whole-operation deadline, not a socket inactivity timeout. */
export function createPushHttpTransport({ requestFn = request, nowFn = () => performance.now(),
  destinationResolver = createPushDestinationResolver(),
  maxResponseBytes = 65_536, maxHeaderSize = 16_384,
  setTimeoutFn = setTimeout, clearTimeoutFn = clearTimeout,
} = {}) {
  if (!Number.isInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 65_536
    || !Number.isInteger(maxHeaderSize) || maxHeaderSize < 1 || maxHeaderSize > 16_384) {
    throw new RangeError('Push transport response limits are invalid');
  }
  async function sendRequest({ requestDetails, deadlineAt }) {
    let endpoint;
    try {
      endpoint = parsePushEndpoint(requestDetails.endpoint);
      if (requestDetails.method !== 'POST' || !requestDetails.headers || typeof requestDetails.headers !== 'object'
        || Array.isArray(requestDetails.headers) || (requestDetails.body != null && !Buffer.isBuffer(requestDetails.body))) {
        throw new Error();
      }
    } catch { throw createPushTransportError('invalid_request'); }
    if (!Number.isFinite(deadlineAt)) throw createPushTransportError('invalid_request');
    const deadline = Math.min(deadlineAt, nowFn() + PUSH_TRANSPORT_TIMEOUT_MS);
    const remaining = deadline - nowFn();
    if (remaining <= 0) throw createPushTransportError('timeout');

    return new Promise((resolve, reject) => {
      let outgoing;
      let incoming;
      let timer;
      let settled = false;
      let bytes = 0;
      const controller = new AbortController();
      function finish(error, value) {
        if (settled) return;
        settled = true;
        clearTimeoutFn(timer);
        if (error) {
          controller.abort();
          // Destroy both streams: merely rejecting would leave an active send.
          incoming?.destroy();
          outgoing?.destroy();
          reject(error);
        } else resolve(value);
      }
      function fail(reason) { finish(createPushTransportError(reason)); }
      function expired() {
        if (nowFn() < deadline) return false;
        fail('timeout'); return true;
      }
      timer = setTimeoutFn(() => fail('timeout'), remaining);
      if (settled) return;
      function connect(destination) {
        if (settled || expired()) return;
        const address = destination?.address;
        const family = destination?.family;
        if (!isPublicPushAddress(address) || isIP(address) !== family) { fail('destination_blocked'); return; }
        const lookup = (hostname, options, callback) => {
          if (typeof options === 'function') { callback = options; options = {}; }
          if (hostname !== endpoint.hostname || settled || controller.signal.aborted || expired()) {
            callback(createPushTransportError('request_failed')); return;
          }
          if (options?.all) callback(null, [{ address, family }]);
          else callback(null, address, family);
        };
        // Host is derived from the validated capability URL, never supplied by
        // generated headers. The original hostname also controls SNI/TLS checks.
        const headers = Object.fromEntries(Object.entries(requestDetails.headers).filter(([name]) => name.toLowerCase() !== 'host'));
        headers.Host = endpoint.host;
        try {
          outgoing = requestFn(endpoint, { method: 'POST', headers, lookup, family, autoSelectFamily: false,
            servername: endpoint.hostname, agent: false, rejectUnauthorized: true, maxHeaderSize }, (response) => {
            incoming = response;
            incoming.on('error', () => fail('request_failed'));
            if (settled) { incoming.destroy(); return; }
            incoming.once('aborted', () => fail('request_failed'));
            incoming.once('close', () => { if (!incoming.complete) fail('request_failed'); });
            incoming.on('data', (chunk) => {
              if (settled || expired()) return;
              bytes += Buffer.byteLength(chunk);
              if (bytes > maxResponseBytes) fail('response_too_large');
            });
            incoming.once('end', () => {
              if (settled || expired()) return;
              const statusCode = incoming.statusCode;
              if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599 || incoming.complete === false) {
                fail('request_failed'); return;
              }
              const retryAfter = incoming.headers?.['retry-after'];
              const responseHeaders = typeof retryAfter === 'string' && retryAfter.length <= 256 ? { 'retry-after': retryAfter } : {};
              finish(null, { statusCode, headers: responseHeaders });
            });
            if (expired()) return;
            const contentLength = incoming.headers?.['content-length'];
            if (typeof contentLength === 'string' && /^\d+$/.test(contentLength) && Number(contentLength) > maxResponseBytes) {
              fail('response_too_large');
            }
          });
          // Leave safe error listeners attached so late errors after destruction
          // cannot become unhandled events or expose native/provider text.
          outgoing.on('error', (error) => fail(error?.code === 'HPE_HEADER_OVERFLOW' ? 'response_too_large' : 'request_failed'));
          outgoing.once('close', () => { if (!incoming) fail('request_failed'); });
          if (settled || expired()) outgoing.destroy();
          else outgoing.end(requestDetails.body ?? undefined);
        } catch { fail('request_failed'); }
      }
      Promise.resolve().then(() => {
        if (settled || expired()) return null;
        return destinationResolver.resolveDestination({ hostname: endpoint.hostname, signal: controller.signal });
      }).then(connect).catch((error) => {
        fail(error?.code === 'push_destination_blocked' ? 'destination_blocked' : 'request_failed');
      });
    });
  }
  return { sendRequest };
}
