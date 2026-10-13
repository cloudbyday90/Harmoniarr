/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Parent publishers and root-input statement triggers share this transaction lock. */
export async function lockLibraryRequestProjection({ queryable }) {
  await queryable.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['harmoniarr.library-request-projection']);
}
