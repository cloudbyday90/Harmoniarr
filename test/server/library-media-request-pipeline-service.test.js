/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { createLibraryMediaRequestPipelineService } from '../../src/server/library/library-media-request-pipeline-service.js';

test('buildPipeline returns empty candidates without reading when mediaRequestId is absent', async (t) => {
  const getReadableMediaRequest = t.mock.fn();
  const listPipelineCandidates = t.mock.fn();
  const service = createLibraryMediaRequestPipelineService({
    getReadableMediaRequest,
    pipelineStore: { listPipelineCandidates },
  });

  assert.deepEqual(await service.buildPipeline({ mediaRequestId: '' }), { candidates: [] });
  assert.equal(getReadableMediaRequest.mock.callCount(), 0);
  assert.equal(listPipelineCandidates.mock.callCount(), 0);
});

test('buildPipeline authorizes the request before loading candidates', async (t) => {
  const getReadableMediaRequest = t.mock.fn(async () => ({ id: 'req-1' }));
  const listPipelineCandidates = t.mock.fn(async () => []);
  const service = createLibraryMediaRequestPipelineService({
    getReadableMediaRequest,
    pipelineStore: { listPipelineCandidates },
  });

  const result = await service.buildPipeline({
    actorUserId: 'user-1',
    actorUserRole: 'requester',
    mediaRequestId: 'req-1',
  });

  assert.deepEqual(result, { candidates: [] });
  assert.deepEqual(getReadableMediaRequest.mock.calls[0].arguments, [{
    actorUserId: 'user-1',
    actorUserRole: 'requester',
    mediaRequestId: 'req-1',
  }]);
  assert.deepEqual(listPipelineCandidates.mock.calls[0].arguments, [{
    mediaRequestId: 'req-1',
  }]);
});

test('buildPipeline returns an allowlisted transfer projection without the internal snapshot', async () => {
  const service = createLibraryMediaRequestPipelineService({
    getReadableMediaRequest: async () => ({ id: 'req-1' }),
    pipelineStore: {
      listPipelineCandidates: async () => [{
        id: 'candidate-1',
        status: 'downloading',
        execution: {
          operationRunId: 'run-1',
          importCandidateId: 'candidate-1',
          itemStatus: 'in_progress',
          statusMessage: 'Downloading',
          startedAt: '2026-05-31T12:00:00.000Z',
          finishedAt: null,
          runStatus: 'running',
          runErrorMessage: null,
          planningSnapshot: {
            candidate: {
              folderPath: '/private/staging/artist/album',
              username: 'remote-peer',
            },
            execution: {
              enqueuedTransfers: [{
                filename: 'private-track.flac',
                id: 'transfer-1',
                username: 'remote-peer',
              }],
              latestTransferSnapshot: {
                lastReconciledAt: '2026-05-31T12:01:02.000Z',
                summary: {
                  bytesTransferred: 500,
                  message: '1 transfer is actively progressing.',
                  percentComplete: 42,
                  status: 'active',
                  totalBytes: 1200,
                },
                transfers: [{
                  filename: 'private-track.flac',
                  id: 'transfer-1',
                  username: 'remote-peer',
                }],
              },
            },
          },
        },
        apply: null,
      }],
    },
  });

  const result = await service.buildPipeline({
    actorUserId: 'user-1',
    actorUserRole: 'requester',
    mediaRequestId: 'req-1',
  });
  const candidate = result.candidates[0];

  assert.deepEqual(candidate.transferProgress, {
    observedAt: '2026-05-31T12:01:02.000Z',
    percentComplete: 42,
    status: 'active',
  });
  assert.equal('planningSnapshot' in candidate.execution, false);
  assert.equal(JSON.stringify(candidate).includes('private-track.flac'), false);
});

test('buildPipeline does not query pipeline data when request access is denied', async (t) => {
  const listPipelineCandidates = t.mock.fn();
  const service = createLibraryMediaRequestPipelineService({
    getReadableMediaRequest: async () => {
      throw createApiError(404, 'media_request_not_found', 'The specified media request could not be found');
    },
    pipelineStore: { listPipelineCandidates },
  });

  await assert.rejects(
    service.buildPipeline({
      actorUserId: 'user-2',
      actorUserRole: 'requester',
      mediaRequestId: 'req-1',
    }),
    (error) => error?.status === 404 && error?.code === 'media_request_not_found',
  );
  assert.equal(listPipelineCandidates.mock.callCount(), 0);
});

test('buildPipeline fails closed when request authorization is not composed', async () => {
  const service = createLibraryMediaRequestPipelineService({
    pipelineStore: {
      listPipelineCandidates: async () => [],
    },
  });

  await assert.rejects(
    service.buildPipeline({
      actorUserId: 'user-1',
      actorUserRole: 'requester',
      mediaRequestId: 'req-1',
    }),
    /getReadableMediaRequest dependency is required/,
  );
});
