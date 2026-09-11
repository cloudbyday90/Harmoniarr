/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { MISSING_MUSIC_MAX_SCAN_ROWS, MISSING_MUSIC_PAGE_LIMIT } from './missing-music-decision-page-policy.js';

export function createMissingMusicDecisionPageService({ listWantedReleaseIdentityPage, listWantedReleasesWithMetadata }) {
  if (typeof listWantedReleaseIdentityPage !== 'function' || typeof listWantedReleasesWithMetadata !== 'function') {
    throw new TypeError('Missing Music pagination requires identity and evidence reads');
  }

  async function readDecisionPage({ appUserIds, search, state, limit, after, projectDecision }) {
    const decisions = [];
    const scanBudget = state === 'all' ? limit : MISSING_MUSIC_MAX_SCAN_ROWS;
    let scannedCount = 0;
    let lastExamined = after;
    let hasMore = false;
    while (scannedCount < scanBudget && decisions.length < limit) {
      const batchLimit = Math.min(scanBudget - scannedCount, Math.max(limit, MISSING_MUSIC_PAGE_LIMIT));
      const source = await listWantedReleaseIdentityPage({ appUserIds, search, after: lastExamined, limit: batchLimit });
      const rows = source.rows;
      if (!rows.length) { hasMore = false; break; }
      const releases = await listWantedReleasesWithMetadata({
        appUserIds, wantedReleaseIds: rows.map((row) => row.id), limit: rows.length,
        search, wantedStatus: null,
      });
      const byId = new Map(releases.filter((release) => appUserIds.includes(release.appUserId)).map((release) => [release.id, release]));
      scannedCount += rows.length;
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        lastExamined = row;
        hasMore = index < rows.length - 1 || source.hasMore;
        const release = byId.get(row.id);
        if (release) {
          const decision = projectDecision(release);
          if (state === 'all' || decision.state === state) decisions.push(decision);
        }
        if (decisions.length === limit) break;
      }
      if (!hasMore) break;
    }
    return {
      decisions, hasMore, nextAnchor: hasMore ? lastExamined : null, scannedCount,
      scanLimitReached: hasMore && scannedCount >= scanBudget && decisions.length < limit,
    };
  }

  return { readDecisionPage };
}
