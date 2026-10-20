/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { projectSlskdSearchDiagnostics } from '../../shared/slskd-search-diagnostics.js';

export function buildMissingMusicSearchDiagnostics(release) {
  const request = release?.discoveryRequest;
  const evidence = request?.evidence;
  const result = evidence?.lastSearchResult;
  if (!['cooldown', 'blocked'].includes(request?.requestStatus) || evidence?.lastDispatchFailure
    || evidence?.searchContinuation || result?.sourceProvider !== 'slskd'
    || result.candidateCount !== 0 || result.fileCount !== 0) return null;
  return projectSlskdSearchDiagnostics(result.ingestionDiagnostics);
}
