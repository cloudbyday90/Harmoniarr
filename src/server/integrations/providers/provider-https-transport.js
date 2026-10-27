/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createOwnedHttpsTransport } from '../../network/owned-https-transport.js';
import { startBoundedHttpsResponse } from '../../network/bounded-https-response.js';
import { admitProviderDestination, providerTransportError } from './provider-http-policy.js';

export function createProviderHttpsTransport(options = {}) {
  return createOwnedHttpsTransport({ ...options, admitDestination: value => admitProviderDestination(value), createError: providerTransportError,
    readResponse(incoming, context) {
      try {
        const reader = startBoundedHttpsResponse(incoming, { ...context, compression: true, readErrors: true });
        return { ...reader, result: reader.result.catch(error => {
          if (incoming.statusCode >= 400 && !context.signal.aborted) return { status: incoming.statusCode, headers: new Headers(incoming.headers), body: Buffer.alloc(0) };
          throw error;
        }) };
      } catch (error) {
        if (incoming.statusCode < 400) throw error;
        return { result: Promise.resolve({ status: incoming.statusCode, headers: new Headers(incoming.headers), body: Buffer.alloc(0) }), drained: Promise.resolve(true), cancel() {} };
      }
    } });
}
