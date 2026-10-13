/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { wantedRootReadTransaction } from '../library/wanted-root-read-authority-service.js';

/** Only an exact, locked positive source in this publication transaction proves a no-op. */
export async function tryLockedOperatorTrackSourceNoop({ source, queryable, rootReadAuthority }) {
  const transactionId = wantedRootReadTransaction(rootReadAuthority, queryable);
  if (!transactionId || source.available !== true) return false;
  // Capture every SQL input before the first await. Missing rows never grant a skip.
  const params = [source.mediaRequestId, source.ownerId, source.scope.metadataReleaseId,
    JSON.stringify(source.scope), transactionId];
  await queryable.query('SAVEPOINT harmoniarr_track_source_noop');
  let result;
  try {
    result = await queryable.query(`SELECT id FROM media_requests
      WHERE id=$1::uuid AND requested_for_user_id=$2::uuid AND matched_metadata_release_id=$3::uuid
        AND evidence #> '{operatorArtistReconciliation,operatorTrackScope}'=$4::jsonb
        AND request_state='already_exists' AND pg_catalog.pg_current_xact_id()::text=$5
      FOR NO KEY UPDATE NOWAIT`, params);
  } catch (error) {
    if (error?.code !== '55P03') throw error;
    await queryable.query('ROLLBACK TO SAVEPOINT harmoniarr_track_source_noop');
    await queryable.query('RELEASE SAVEPOINT harmoniarr_track_source_noop');
    return false;
  }
  await queryable.query('RELEASE SAVEPOINT harmoniarr_track_source_noop');
  return result.rowCount === 1 && result.rows[0]?.id === params[0];
}
