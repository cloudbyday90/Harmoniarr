/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { createPublicDestinationResolver } from '../network/public-destination-resolver.js';
import { PUSH_TRANSPORT_TIMEOUT_MS } from './push-delivery-budget.js';

const messages = { blocked: 'Push destination is not permitted', failed: 'Push destination could not be resolved',
  cancelled: 'Push destination resolution was cancelled' };

export function createPushDestinationResolver({ createResolverFn } = {}) {
  const resolver = createPublicDestinationResolver({ createResolverFn, timeoutMs: PUSH_TRANSPORT_TIMEOUT_MS });
  async function resolveDestination(input) {
    try { return (await resolver.resolveDestinations(input))[0]; }
    catch (error) {
      const reason = error?.code === 'egress_destination_blocked' ? 'blocked'
        : error?.code === 'egress_destination_cancelled' ? 'cancelled' : 'failed';
      throw Object.assign(new Error(messages[reason]), { code: `push_destination_${reason}` });
    }
  }
  return { resolveDestination };
}
