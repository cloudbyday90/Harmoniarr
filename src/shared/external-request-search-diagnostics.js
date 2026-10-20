/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { projectSlskdSearchDiagnostics } from './slskd-search-diagnostics.js';

/** An idempotent allowlist for successful ingestion with responses but no candidates. */
export function projectExternalRequestSearchDiagnostics(value) {
  const projected = projectSlskdSearchDiagnostics(value);
  return projected?.responseCount > 0 ? projected : null;
}
