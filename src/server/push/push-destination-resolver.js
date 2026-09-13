/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isPublicPushAddress } from './push-public-address-policy.js';
import { PUSH_TRANSPORT_TIMEOUT_MS } from './push-delivery-budget.js';

const emptyFamilyCodes = new Set(['ENODATA', 'ENOTFOUND']);
const errors = Object.freeze({ blocked: 'Push destination is not permitted', failed: 'Push destination could not be resolved',
  cancelled: 'Push destination resolution was cancelled' });
function destinationError(reason) { return Object.assign(new Error(errors[reason]), { code: `push_destination_${reason}` }); }

/** Per-send cancellable DNS; no shared cache, OS hosts file, or connection fallback. */
export function createPushDestinationResolver({
  createResolverFn = () => new Resolver({ timeout: PUSH_TRANSPORT_TIMEOUT_MS, tries: 1 }),
} = {}) {
  async function resolveDestination({ hostname, signal }) {
    if (signal?.aborted) throw destinationError('cancelled');
    if (typeof hostname !== 'string' || !hostname || typeof signal?.addEventListener !== 'function') throw destinationError('failed');
    let resolver;
    try { resolver = createResolverFn(); } catch { throw destinationError('failed'); }
    return new Promise((resolve, reject) => {
      let settled = false;
      function finish(error, destination) {
        if (settled) return;
        settled = true;
        signal.removeEventListener('abort', abort);
        if (error) {
          try { resolver.cancel(); } catch { /* Preserve fixed diagnostics even if cancellation fails. */ }
          reject(error);
        } else resolve(destination);
      }
      function abort() { finish(destinationError('cancelled')); }
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) { abort(); return; }
      const queries = [4, 6].map(async (family) => {
        if (signal.aborted) throw destinationError('cancelled');
        try {
          const addresses = await resolver[`resolve${family}`](hostname);
          if (!Array.isArray(addresses) || addresses.length > 64
            || !Array.from(addresses).every((address) => typeof address === 'string' && isIP(address) === family && isPublicPushAddress(address))) {
            throw destinationError('blocked');
          }
          return addresses.map((address) => ({ address, family }));
        } catch (error) {
          if (emptyFamilyCodes.has(error?.code)) return [];
          if (error?.code === 'push_destination_blocked') throw error;
          throw destinationError('failed');
        }
      });
      Promise.all(queries).then((families) => {
        if (settled) return;
        const answers = families.flat();
        if (answers.length > 64) { finish(destinationError('blocked')); return; }
        if (!answers.length) { finish(destinationError('failed')); return; }
        finish(null, Object.freeze({ ...answers[0] }));
      }, (error) => finish(error));
    });
  }
  return { resolveDestination };
}
