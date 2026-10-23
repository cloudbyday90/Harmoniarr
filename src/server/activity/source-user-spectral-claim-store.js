/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { getPool } from '../database.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { throwIfMediaCancelled } from '../media/media-cancellation.js';
import { withDatabasePublicationScope } from '../database-publication-scope.js';

export function captureSpectralJobClaim({ id, attempts } = {}) {
  if (typeof id !== 'string' || !id.trim() || !Number.isSafeInteger(attempts) || attempts < 1) {
    throw new TypeError('A captured spectral job claim is required');
  }
  return Object.freeze({ id, attempts });
}

export function createSpectralClaimLostError() {
  return Object.assign(new Error('Spectral job claim ownership was lost'), { code: 'spectral_job_claim_lost' });
}

/** The attempt counter increases on every claim and is never reset by queue writers. */
export function createSourceUserSpectralClaimStore({ getPoolFn = getPool,
  withTransaction = createDatabaseTransactionRunner({ getPoolFn }) } = {}) {
  async function isSpectralJobClaimCurrent({ expectedClaim }) {
    const claim = captureSpectralJobClaim(expectedClaim);
    const result = await getPoolFn().query("SELECT id FROM source_user_spectral_jobs WHERE id=$1 AND attempts=$2 AND state='active'", [claim.id, claim.attempts]);
    return result.rows.length === 1;
  }

  async function withSpectralJobClaim({ expectedClaim, signal }, work) {
    const claim = captureSpectralJobClaim(expectedClaim); throwIfMediaCancelled(signal);
    return withTransaction(async queryable => {
      await queryable.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
      const result = await queryable.query("SELECT id FROM source_user_spectral_jobs WHERE id=$1 AND attempts=$2 AND state='active' FOR UPDATE", [claim.id, claim.attempts]);
      throwIfMediaCancelled(signal);
      if (result.rows.length !== 1) throw createSpectralClaimLostError();
      const value = await withDatabasePublicationScope({ queryable, kind: 'spectral_job', ownerId: claim.id }, work);
      throwIfMediaCancelled(signal);
      return value;
    });
  }

  async function releaseSpectralJobClaim({ expectedClaim }) {
    const claim = captureSpectralJobClaim(expectedClaim);
    return (await getPoolFn().query(`UPDATE source_user_spectral_jobs SET state='pending', claimed_at=NULL, updated_at=NOW()
      WHERE id=$1 AND attempts=$2 AND state='active' RETURNING id`, [claim.id, claim.attempts])).rows.length === 1;
  }

  return { isSpectralJobClaimCurrent, withSpectralJobClaim, releaseSpectralJobClaim };
}
