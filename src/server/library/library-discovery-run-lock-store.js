/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export async function lockLibraryDiscoveryRunCreation({ queryable }) {
  await queryable.query("SELECT pg_advisory_xact_lock(hashtextextended('harmoniarr.library-discovery-run-start', 0))");
}
