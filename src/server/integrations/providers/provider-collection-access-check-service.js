/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createApiError } from '../../auth.js';
import { buildProviderIngestPlan, normalizeExternalMediaSource } from '../../library/external-media-source-parser.js';
import { buildCollectionWorkKey, isCollectionSource, requireProviderIdentifier } from '../../library/provider-collection-cursor-policy.js';
import { fetchProviderCollectionWork } from '../../library/provider-collection-fetch-service.js';
import { adaptProviderCollectionPage } from '../../library/provider-collection-page-adapter.js';
import { awaitProviderRequest } from '../provider-request-cancellation.js';
import { createProviderClientResolverService } from './provider-client-resolver-service.js';
import { createProviderRequestError } from './provider-request-error.js';
import { classifyProviderAccessError, presentProviderCollectionAccessCheck, providerCollectionAccessCheckLimits } from './provider-collection-access-check-policy.js';

function bounded(value, maximum) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) throw new Error('Invalid internal provider check limit');
  return value;
}

export function createProviderCollectionAccessCheckService({
  resolveProviderClient = createProviderClientResolverService().resolveProviderClient,
  getNow = () => new Date(),
  deadlineMs = providerCollectionAccessCheckLimits.deadlineMs,
  maxPages = providerCollectionAccessCheckLimits.pages,
  maxRequests = providerCollectionAccessCheckLimits.requests,
} = {}) {
  bounded(deadlineMs, providerCollectionAccessCheckLimits.deadlineMs);
  bounded(maxPages, providerCollectionAccessCheckLimits.pages);
  bounded(maxRequests, providerCollectionAccessCheckLimits.requests);
  let active = false;
  async function checkCollectionAccess({ sourceUrl } = {}) {
    let source;
    try {
      if (typeof sourceUrl !== 'string' || sourceUrl.length > 4096 || !sourceUrl.trim()) throw new Error();
      const url = new URL(sourceUrl);
      if (url.username || url.password) throw new Error();
      source = normalizeExternalMediaSource(sourceUrl);
      if (!isCollectionSource(source)) throw new Error();
      requireProviderIdentifier(source.sourceIdentifier);
      if (source.provider === 'apple_music' && !/^[a-z]{2}$/.test(source.storefront ?? '')) throw new Error();
    } catch { throw createApiError(400, 'validation_error', 'sourceUrl must identify a supported provider playlist or artist collection'); }
    if (active) throw createApiError(409, 'provider_diagnostic_busy', 'A provider access check is already running. Wait for it to finish.');
    active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), deadlineMs);
    const signal = controller.signal;
    const state = { provider: source.provider, resourceType: source.resourceType, authMode: 'none',
      pagesChecked: 0, entriesSeen: 0, hasMore: null,
      snapshotCheck: source.provider === 'spotify' && source.resourceType === 'playlist' ? 'not_checked' : 'not_applicable',
      checkedAt: getNow().toISOString() };
    let requests = 0;
    const assertActive = async () => { if (signal.aborted) throw createProviderRequestError(source.provider, 'timeout'); };
    const requestPolicy = { signal, maxResponseBytes: 2_000_000, beforeRequest: async () => {
      await assertActive();
      if (++requests > maxRequests) throw createProviderRequestError(source.provider, 'request_budget_exceeded');
    } };
    try {
      const resolved = await awaitProviderRequest(resolveProviderClient({ provider: source.provider, requestPolicy }), { signal });
      state.authMode = resolved.authMode;
      if (!resolved.enabled) return presentProviderCollectionAccessCheck(state, 'disabled');
      if (!resolved.configured || !resolved.client) return presentProviderCollectionAccessCheck(state, 'configuration_required');
      const clients = { [source.provider === 'apple_music' ? 'appleMusic' : source.provider]: resolved.client };
      const collection = { storefront: source.storefront, providerSnapshot: null };
      let row = buildProviderIngestPlan({ normalizedSource: source })[0];
      row.ingestKey = buildCollectionWorkKey(row);
      const cursors = new Set([row.ingestKey]);
      for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
        const fetched = await awaitProviderRequest(fetchProviderCollectionWork({ row, collection, clients, assertActive }), { signal });
        const page = adaptProviderCollectionPage({ row, response: fetched.response, storefront: collection.storefront });
        if (!Number.isSafeInteger(page.itemsSeen) || page.itemsSeen < 0 || page.itemsSeen > 100
          || state.entriesSeen + page.itemsSeen > 200) throw createProviderRequestError(source.provider, 'response_invalid');
        state.pagesChecked++;
        state.entriesSeen += page.itemsSeen;
        state.hasMore = page.nextPageCursor !== null;
        if (fetched.providerSnapshot) {
          collection.providerSnapshot = fetched.providerSnapshot;
          state.snapshotCheck = 'verified';
        }
        if (!state.hasMore) break;
        row = page.derivedRequests.find((work) => ['playlist_page', 'artist'].includes(work.ingestTargetType));
        if (!row || cursors.has(row.ingestKey)) throw Object.assign(new Error('Collection continuation cannot be verified'), { collectionBlocked: true });
        cursors.add(row.ingestKey);
      }
      await assertActive();
      return presentProviderCollectionAccessCheck(state, 'access_verified');
    } catch (error) {
      if (error?.providerAuthMode) state.authMode = error.providerAuthMode;
      if (['provider_collection_snapshot_changed', 'provider_collection_snapshot_invalid'].includes(error?.code)) state.snapshotCheck = 'failed';
      return presentProviderCollectionAccessCheck(state, signal.aborted ? 'timeout' : classifyProviderAccessError(error), error);
    } finally {
      clearTimeout(timer);
      controller.abort();
      active = false;
    }
  }
  return { checkCollectionAccess };
}
