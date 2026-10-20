/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { randomUUID } from 'node:crypto';
import { createApiError } from '../auth.js';
import { createDatabaseTransactionRunner } from '../database-transaction-service.js';
import { createSlskdSearchIntentStore } from './slskd-search-intent-store.js';
import { searchUuidPattern, slskdSearchIntentFingerprint } from './slskd-search-binding-policy.js';

export function createSlskdSearchContinuationService({
  slskdService,
  store = createSlskdSearchIntentStore(),
  withTransaction = createDatabaseTransactionRunner(),
  getNow = () => new Date(),
  createSearchId = randomUUID,
  expiresAfterMs = 30 * 60 * 1000,
} = {}) {
  if (!Number.isInteger(expiresAfterMs) || expiresAfterMs <= 0 || expiresAfterMs > 24 * 60 * 60 * 1000) throw new TypeError('Invalid search continuation expiry');

  async function getOrStartSearch({ owner, query, context, assertCurrent, onReservation = null }) {
    const ids = [owner?.discoveryRequestId, owner?.externalRequestIntentId].filter(value => value != null);
    if (ids.length !== 1 || typeof ids[0] !== 'string' || !searchUuidPattern.test(ids[0]) || typeof assertCurrent !== 'function') throw new TypeError('Search continuation requires one owner and a current-authority guard');
    const normalizedQuery = typeof query === 'string' ? query.replace(/\s+/gu, ' ').trim() : '';
    if (!normalizedQuery || normalizedQuery.length > 200) throw createApiError(400, 'validation_error', 'A valid search query is required');
    const intentFingerprint = slskdSearchIntentFingerprint({ query: normalizedQuery, context });
    await assertCurrent();
    const searchBinding = await slskdService.getSearchBinding();
    const now = getNow();
    const reservation = await withTransaction(async queryable => {
      await assertCurrent({ queryable });
      if (await slskdService.getSearchBinding({ queryable }) !== searchBinding) throw createApiError(409, 'slskd_search_provider_changed', 'The search connection changed.');
      const reserved = await store.reserve({ queryable, owner, intentFingerprint, providerFingerprint: searchBinding,
        searchId: createSearchId(), createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + expiresAfterMs).toISOString() });
      if (reserved.row.provider_fingerprint !== searchBinding) throw createApiError(409, 'slskd_search_provider_changed', 'The saved search belongs to a different connection.');
      if (getNow().getTime() >= new Date(reserved.row.expires_at).getTime()) throw createApiError(409, 'slskd_search_continuation_expired', 'This search has expired. Request a new search when ready.');
      if (onReservation) await onReservation({ queryable, searchId: reserved.row.id });
      return reserved;
    });
    const { row } = reservation;
    if (row.provider_fingerprint !== searchBinding) throw createApiError(409, 'slskd_search_provider_changed', 'The saved search belongs to a different connection.');
    const assertSearchCurrent = async (input = {}) => {
      await assertCurrent(input);
      if (await slskdService.getSearchBinding(input) !== searchBinding) throw createApiError(409, 'slskd_search_provider_changed', 'The search connection changed.');
      if (getNow().getTime() >= new Date(row.expires_at).getTime()) throw createApiError(409, 'slskd_search_continuation_expired', 'This search has expired. Request a new search when ready.');
    };
    await assertSearchCurrent();
    // The reservation creator alone may POST. An existing reservation is always
    // read, including after a crash/uncertain acceptance or before accepted_at.
    let search;
    try {
      search = reservation.created
        ? await slskdService.startSearch({ id: row.id, query: normalizedQuery, searchBinding })
        : await slskdService.getSearchState({ searchId: row.id, searchBinding });
    } catch (error) {
      if (!reservation.created && error?.details?.status === 404) throw createApiError(409, 'slskd_search_continuation_unavailable',
        'The saved search is unavailable. Review it before requesting a new search.');
      throw error;
    }
    await assertSearchCurrent();
    if (search?.id !== row.id || search?.query !== normalizedQuery) throw createApiError(502, 'slskd_search_identity_invalid', 'The provider search identity could not be verified.');
    await withTransaction(async queryable => {
      await assertSearchCurrent({ queryable });
      await store.markAccepted({ queryable, searchId: row.id, acceptedAt: getNow().toISOString() });
    });
    return { id: row.id, searchBinding, assertSearchCurrent, resumed: !reservation.created };
  }

  return { getOrStartSearch };
}
