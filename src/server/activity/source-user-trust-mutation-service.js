/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

/** Preserve injected snapshot adapters; borrowed publication requires the actual transaction owner. */
export function createSourceUserTrustMutation({ mutateTrustSnapshot = null, listTrustSnapshot, replaceTrustSnapshot }) {
  return async function mutate(update, options = {}) {
    if (typeof mutateTrustSnapshot === 'function') return mutateTrustSnapshot(update, options);
    if (options.queryable) throw new TypeError('Transactional trust snapshot mutation is required');
    const loaded = await listTrustSnapshot();
    const rows = Array.isArray(loaded) ? loaded.filter(row => row && typeof row === 'object').map(row => ({ ...row })) : [];
    const result = await update(rows, null);
    await replaceTrustSnapshot({ sourceUsers: rows });
    return result;
  };
}
