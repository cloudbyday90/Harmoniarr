/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

const admissionKey = 'harmoniarr.metadata-source-admission';

/** All cooperating readers and writers acquire admission before scopes or source rows. */
export function lockMetadataSourceRead({ queryable }) {
  return queryable.query('SELECT pg_advisory_xact_lock_shared(hashtextextended($1,0))', [admissionKey]);
}

/** Catalog and bulk replacement need the strongest admission mode at entry. */
export function lockMetadataSourceWrite({ queryable }) {
  return queryable.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [admissionKey]);
}
