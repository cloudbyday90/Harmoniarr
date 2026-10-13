/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { createApiError } from '../auth.js';
import { readWantedRootReadAuthorityProof } from './wanted-root-read-authority-store.js';
import { validWantedRootReadProof } from './wanted-root-read-authority-policy.js';

const scopes = new WeakMap();
export function wantedRootReadTransaction(authority, queryable) {
  const scope = authority && scopes.get(authority);
  return scope && scope.queryable === queryable ? scope.transactionId : null;
}
/** No cached root values or queryable registrations survive this invocation. */
export async function withWantedRootReadAuthority({ queryable }, work) {
  const rows = await readWantedRootReadAuthorityProof({ queryable });
  if (!validWantedRootReadProof(rows)) throw createApiError(409, 'library_wanted_projection_stale', 'Current root authority could not be verified');
  const authority = Object.freeze({}); scopes.set(authority, { queryable, transactionId: rows[0].transaction_id });
  try { return await work(authority); }
  finally { scopes.delete(authority); }
}
