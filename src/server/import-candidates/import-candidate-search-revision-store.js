/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from '../database.js';

/** Read committed writer evidence without introducing a command-side lock order. */
export function createImportCandidateSearchRevisionStore({ getPoolFn = getPool } = {}) {
  async function readRevision({ sourceSearchId, queryable = null }) {
    const result = await (queryable ?? getPoolFn()).query(
      'SELECT revision FROM import_candidate_search_revisions WHERE source_search_id=$1', [sourceSearchId]);
    return result.rows[0]?.revision ?? null;
  }
  async function lockRevisionNowait({ sourceSearchId, queryable }) {
    if (!queryable) throw new TypeError('Revision fencing requires an owning transaction');
    await queryable.query("SET LOCAL lock_timeout='250ms'");
    const result = await queryable.query('SELECT revision FROM import_candidate_search_revisions WHERE source_search_id=$1 FOR UPDATE NOWAIT', [sourceSearchId]);
    return result.rows[0]?.revision ?? null;
  }
  return { readRevision, lockRevisionNowait };
}
