/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const scopes = new WeakMap();

export function assertDatabasePublicationScope(queryable, { kind, ownerId } = {}) {
  const scope = queryable && scopes.get(queryable);
  if (!scope || scope.kind !== kind || (ownerId !== undefined && scope.ownerId !== ownerId)) {
    throw new TypeError('Current database publication authority is required');
  }
  return scope;
}

/** A fresh facade per invocation prevents a retained client from regaining authority on reuse. */
export async function withDatabasePublicationScope({ queryable, kind, ownerId }, work) {
  const scope = Object.freeze({ kind, ownerId });
  const owned = Object.freeze({ query(...args) {
    assertDatabasePublicationScope(owned, scope);
    return queryable.query(...args);
  } });
  scopes.set(owned, scope);
  try { return await work(owned); }
  finally { scopes.delete(owned); }
}
