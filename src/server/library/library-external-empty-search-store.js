/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

export function createLibraryExternalEmptySearchStore() {
  async function recordPublishedEmptySearch({ intentId, operationRunId, queryable }) {
    await queryable.query(`UPDATE library_external_request_release_intents
      SET last_empty_search_at=clock_timestamp(),last_empty_search_run_id=$2
      WHERE id=$1 AND operation_run_id=$2 AND last_empty_search_run_id IS DISTINCT FROM $2::uuid`,
    [intentId, operationRunId]);
  }
  async function getDatabaseTime(queryable) {
    return (await queryable.query('SELECT clock_timestamp() AS now')).rows[0].now;
  }
  async function consumeRecovery({ intentId, queryable }) {
    const result = await queryable.query(`UPDATE library_external_request_release_intents
      SET empty_search_recovery_count=empty_search_recovery_count+1
      WHERE id=$1 AND last_empty_search_at IS NOT NULL AND empty_search_recovery_count<2
        AND last_empty_search_at + interval '6 hours' <= clock_timestamp() RETURNING id`, [intentId]);
    return result.rowCount === 1;
  }
  return { recordPublishedEmptySearch, getDatabaseTime, consumeRecovery };
}
