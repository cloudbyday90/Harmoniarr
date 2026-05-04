import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFallbackMediaRequestFulfillmentStatus,
  buildMediaRequestFulfillmentCounts,
  buildMediaRequestFulfillmentStatus,
  createLibraryMediaRequestFulfillmentService,
} from '../../src/server/library/library-media-request-fulfillment-service.js';

test('buildMediaRequestFulfillmentStatus falls back to request classification when no candidate exists', () => {
  assert.deepEqual(buildFallbackMediaRequestFulfillmentStatus({ requestState: 'already_exists' }), {
    code: 'already_available',
    detail: 'This request already matched imported media.',
    label: 'Already available',
    occurredAt: null,
    tone: 'selected',
  });
  assert.deepEqual(buildMediaRequestFulfillmentStatus({
    importCandidates: [],
    request: { requestState: 'needs_fetch' },
  }), {
    code: 'queued',
    detail: 'Waiting for fetch and discovery follow-up.',
    label: 'Queued',
    occurredAt: null,
    tone: 'held',
  });
});

test('createLibraryMediaRequestFulfillmentService promotes the most advanced linked import candidate status', async () => {
  const service = createLibraryMediaRequestFulfillmentService({
    listImportCandidatesBySourceMediaRequestIds: async () => ([
      {
        id: 'candidate-pending',
        normalizedPayload: {
          requestOwnership: {
            sourceMediaRequestId: 'request-1',
          },
        },
        status: 'pending',
        updatedAt: '2026-05-04T10:00:00.000Z',
      },
      {
        id: 'candidate-applied',
        normalizedPayload: {
          requestOwnership: {
            sourceMediaRequestId: 'request-1',
          },
        },
        status: 'applied',
        updatedAt: '2026-05-04T11:00:00.000Z',
      },
      {
        id: 'candidate-import-pending',
        normalizedPayload: {
          requestOwnership: {
            sourceMediaRequestId: 'request-2',
          },
        },
        status: 'import_pending',
        updatedAt: '2026-05-04T12:00:00.000Z',
      },
    ]),
  });

  const enriched = await service.enrichMediaRequests([
    { id: 'request-1', requestState: 'needs_fetch' },
    { id: 'request-2', requestState: 'needs_fetch' },
    { id: 'request-3', requestState: 'needs_review' },
  ]);

  assert.deepEqual(enriched.map((request) => request.fulfillmentStatus), [
    {
      code: 'fulfilled',
      detail: 'Imported media has been applied to the library.',
      importCandidateId: 'candidate-applied',
      importCandidateStatus: 'applied',
      label: 'Fulfilled',
      occurredAt: '2026-05-04T11:00:00.000Z',
      tone: 'selected',
    },
    {
      code: 'import_pending',
      detail: 'Download completed and is waiting for import apply.',
      importCandidateId: 'candidate-import-pending',
      importCandidateStatus: 'import_pending',
      label: 'Import pending',
      occurredAt: '2026-05-04T12:00:00.000Z',
      tone: 'held',
    },
    {
      code: 'under_review',
      detail: 'Needs operator review before fetch can continue.',
      label: 'Needs review',
      occurredAt: null,
      tone: 'held',
    },
  ]);
  assert.deepEqual(buildMediaRequestFulfillmentCounts(enriched), {
    active: 1,
    alreadyAvailable: 0,
    downloading: 0,
    failed: 0,
    fulfilled: 1,
    importPending: 1,
    queued: 0,
    satisfied: 1,
    totalRequests: 3,
    underReview: 1,
  });
});
