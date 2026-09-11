/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryMediaRequestFulfillmentService } from '../../src/server/library/library-media-request-fulfillment-service.js';

async function scenario({ status = 'reviewed', included = ['first', 'second'], applied = ['first', 'second'],
  target = 'listener', candidateTarget = 'listener', requestState = 'needs_fetch', tracked = true, sourceType = 'playlist' } = {}) {
  const request = { id: 'request', requestKind: 'external_url', requestState, requestedForUser: { id: 'listener' },
    sourceUrl: `https://open.spotify.com/${sourceType}/collection123` };
  const service = createLibraryMediaRequestFulfillmentService({
    listExternalRequestCollectionsByIds: async () => tracked ? [{ mediaRequestId: 'request', status, requestedForUserId: target,
      includedIntentIds: included, pendingCount: 0 }] : [],
    listImportCandidatesBySourceMediaRequestIds: async () => applied.map((id) => ({ id, status: 'applied',
      normalizedPayload: { requestOwnership: { sourceMediaRequestId: 'request', sourceRequestedForUserId: candidateTarget, externalRequestReleaseIntentId: id } } })),
  });
  return (await service.enrichMediaRequests([request]))[0].fulfillmentStatus;
}

test('reviewed selections require all distinct included release imports', async () => {
  assert.equal((await scenario()).code, 'fulfilled');
  assert.equal((await scenario({ applied: ['first'] })).code, 'under_review');
  const coalesced = await scenario({ included: ['first', 'first'], applied: ['first'] });
  assert.equal(coalesced.code, 'fulfilled');
  assert.match(coalesced.detail, /1 of 1 distinct/);
});

test('preparation and unfinalized decisions never imply collection completion', async () => {
  for (const status of ['preparing', 'blocked', 'ready']) assert.equal((await scenario({ status })).code, 'under_review');
  assert.equal((await scenario({ included: [], applied: [] })).code, 'under_review');
});

test('reassignment and unrelated applied candidates cannot fulfill a reviewed selection', async () => {
  assert.equal((await scenario({ target: 'previous-listener' })).code, 'under_review');
  assert.equal((await scenario({ candidateTarget: 'previous-listener' })).code, 'under_review');
  assert.equal((await scenario({ applied: ['unrelated'] })).code, 'under_review');
});

test('cancellation dominates even fully imported reviewed selections', async () => {
  assert.equal((await scenario({ requestState: 'cancelled' })).code, 'cancelled');
  assert.equal((await scenario({ requestState: 'failed' })).code, 'failed');
});

test('historical collection imports without a review ledger cannot use generic fulfillment', async () => {
  for (const sourceType of ['playlist', 'artist']) assert.equal((await scenario({ tracked: false, sourceType })).code, 'under_review');
  assert.equal((await scenario({ tracked: false, sourceType: 'album' })).code, 'fulfilled');
});
