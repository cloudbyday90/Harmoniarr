/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isPublicAddress } from './public-address-policy.js';

const emptyFamilyCodes = new Set(['ENODATA', 'ENOTFOUND']);
const errors = Object.freeze({ blocked: 'Remote destination is not permitted', failed: 'Remote destination could not be resolved',
  cancelled: 'Remote destination resolution was cancelled' });
function destinationError(reason) { return Object.assign(new Error(errors[reason]), { code: `egress_destination_${reason}` }); }

/** Per-hop cancellable DNS; no shared cache or unchecked OS hosts lookup. */
export function createPublicDestinationResolver({
  timeoutMs = 15_000,
  createResolverFn = () => new Resolver({ timeout: timeoutMs, tries: 1 }),
} = {}) {
  async function resolveDestinations({ hostname, signal }) {
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
            || !Array.from(addresses).every((address) => typeof address === 'string' && isIP(address) === family && isPublicAddress(address))) {
            throw destinationError('blocked');
          }
          return addresses.map((address) => ({ address, family }));
        } catch (error) {
          if (emptyFamilyCodes.has(error?.code)) return [];
          if (error?.code === 'egress_destination_blocked') throw error;
          throw destinationError('failed');
        }
      });
      Promise.all(queries).then((families) => {
        if (settled) return;
        const answers = families.flat();
        if (answers.length > 64) { finish(destinationError('blocked')); return; }
        if (!answers.length) { finish(destinationError('failed')); return; }
        finish(null, Object.freeze(answers.map(answer => Object.freeze({ ...answer }))));
      }, (error) => finish(error));
    });
  }
  return { resolveDestinations };
}
