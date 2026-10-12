/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Small transaction-capable pool double; query observers still see every statement. */
export function createMetadataWritePool(query, release = () => {}) {
  return { query, connect: async () => ({ query, release }) };
}

/** Existing SQL-shape checks select domain work while separate tests own transaction admission. */
export function isMetadataDomainStatement(sql) {
  return !/^(?:BEGIN|COMMIT|ROLLBACK|LOCK TABLE|SELECT pg_advisory)/u.test(sql.trim());
}

export function metadataDomainCalls(queryMock) {
  return queryMock.mock.calls.filter(call => isMetadataDomainStatement(call.arguments[0]));
}
