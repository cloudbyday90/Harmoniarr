/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

export function createSlskdSearchIntentStore() {
  async function reserve({ queryable, owner, intentFingerprint, providerFingerprint, searchId, createdAt, expiresAt }) {
    const values = [searchId, owner.discoveryRequestId ?? null, owner.externalRequestIntentId ?? null,
      intentFingerprint, providerFingerprint, createdAt, expiresAt];
    const inserted = await queryable.query(`INSERT INTO slskd_search_intents
      (id,discovery_request_id,external_request_intent_id,intent_fingerprint,provider_fingerprint,created_at,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING *`, values);
    if (inserted.rows[0]) return { row: inserted.rows[0], created: true };
    const existing = await queryable.query(`SELECT * FROM slskd_search_intents
      WHERE discovery_request_id IS NOT DISTINCT FROM $1::uuid
        AND external_request_intent_id IS NOT DISTINCT FROM $2::uuid AND intent_fingerprint=$3
      FOR UPDATE`, [values[1], values[2], intentFingerprint]);
    if (!existing.rows[0]) throw new Error('Search reservation could not be verified');
    return { row: existing.rows[0], created: false };
  }

  async function markAccepted({ queryable, searchId, acceptedAt }) {
    await queryable.query('UPDATE slskd_search_intents SET accepted_at=COALESCE(accepted_at,$2::timestamptz) WHERE id=$1', [searchId, acceptedAt]);
  }
  return { reserve, markAccepted };
}
