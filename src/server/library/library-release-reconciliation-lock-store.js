/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Serialize the global projection, including replacement of an empty set. */
export async function lockLibraryReleaseReconciliation({ queryable }) {
  await queryable.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['harmoniarr.library-release-reconciliation']);
}
