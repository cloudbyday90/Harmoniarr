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

function scenario({ collection = false, applied = ['first'], intents = ['first', 'second'], requestState = 'needs_fetch' } = {}) {
  const request = { id: 'request', requestKind: 'external_url', requestState, requestedForUser: { id: 'listener' },
    sourceUrl: `https://open.spotify.com/${collection ? 'playlist' : 'album'}/12345` };
  const service = createLibraryMediaRequestFulfillmentService({
    listExternalRequestIntentsByIds: async () => intents.map((id) => ({ id, mediaRequestId: 'request', requestedForUserId: 'listener' })),
    listImportCandidatesBySourceMediaRequestIds: async () => applied.map((id) => ({ id, status: 'applied',
      normalizedPayload: { requestOwnership: { sourceMediaRequestId: 'request', sourceRequestedForUserId: 'listener', externalRequestReleaseIntentId: id } },
    })),
  });
  return service.enrichMediaRequests([request]).then(([result]) => result.fulfillmentStatus);
}

test('one applied album cannot fulfill other approved release intents', async () => {
  const status = await scenario();
  assert.equal(status.code, 'under_review');
  assert.match(status.detail, /1 of 2/);
});

test('importing all approved collection leaves does not assert complete collection coverage', async () => {
  const status = await scenario({ collection: true, applied: ['first', 'second'] });
  assert.equal(status.code, 'under_review');
  assert.match(status.detail, /2 of 2/);
  assert.match(status.detail, /Collection completion still needs review/);
});

test('a single release is fulfilled by its approved target-owned import', async () => {
  assert.equal((await scenario({ intents: ['first'] })).code, 'fulfilled');
});

test('unrelated legacy import does not fulfill an approved release intent', async () => {
  const status = await scenario({ intents: ['first'], applied: ['legacy'] });
  assert.equal(status.code, 'under_review');
  assert.match(status.detail, /0 of 1/);
});

test('cancellation still dominates approved album progress', async () => {
  assert.equal((await scenario({ requestState: 'cancelled' })).code, 'cancelled');
});
