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

test('buildPipeline returns requester-safe candidates without peer, folder, or run diagnostics', async () => {
  const service = createLibraryMediaRequestPipelineService({
    getReadableMediaRequest: async () => ({ id: 'req-1' }),
    pipelineStore: {
      listPipelineCandidates: async () => [{
        id: 'candidate-1',
        username: 'remote-peer',
        folderPath: '/private/staging/artist/album',
        candidateType: 'manual_search',
        status: 'downloading',
        fileCount: 3,
        totalSizeBytes: 1200,
        execution: {
          operationRunId: 'run-1',
          importCandidateId: 'candidate-1',
          itemStatus: 'in_progress',
          statusMessage: 'Downloading from remote-peer',
          startedAt: '2026-05-31T12:00:00.000Z',
          finishedAt: null,
          runStatus: 'running',
          runErrorMessage: '/private/staging/artist/album/private-track.flac failed',
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
        apply: {
          operationRunId: 'apply-run-1',
          importCandidateId: 'candidate-1',
          itemStatus: 'pending',
          statusMessage: 'Apply queued',
          startedAt: null,
          finishedAt: null,
          runStatus: 'pending',
          runErrorMessage: 'Pending apply diagnostics',
        },
      }],
    },
  });

  const result = await service.buildPipeline({
    actorUserId: 'user-1',
    actorUserRole: 'requester',
    mediaRequestId: 'req-1',
  });
  const candidate = result.candidates[0];

  assert.deepEqual(Object.keys(candidate).sort(), [
    'apply',
    'execution',
    'fileCount',
    'sourceKey',
    'sourceLabel',
    'status',
    'totalSizeBytes',
    'transferProgress',
  ].sort());
  assert.equal(candidate.sourceKey, 'source-1');
  assert.equal(candidate.sourceLabel, 'Source 1');
  assert.equal(candidate.fileCount, 3);
  assert.equal(candidate.totalSizeBytes, 1200);
  assert.deepEqual(candidate.execution, {
    finishedAt: null,
    itemStatus: 'in_progress',
    runStatus: 'running',
    startedAt: '2026-05-31T12:00:00.000Z',
  });
  assert.deepEqual(candidate.apply, {
    finishedAt: null,
    itemStatus: 'pending',
    runStatus: 'pending',
    startedAt: null,
  });
  assert.deepEqual(candidate.transferProgress, {
    observedAt: '2026-05-31T12:01:02.000Z',
    percentComplete: 42,
    status: 'active',
  });
  const serializedCandidate = JSON.stringify(candidate);
  assert.equal(serializedCandidate.includes('candidate-1'), false);
  assert.equal(serializedCandidate.includes('run-1'), false);
  assert.equal(serializedCandidate.includes('remote-peer'), false);
  assert.equal(serializedCandidate.includes('/private/staging'), false);
  assert.equal(serializedCandidate.includes('private-track.flac'), false);
  assert.equal(serializedCandidate.includes('Downloading from'), false);
  assert.equal(serializedCandidate.includes('failed'), false);
});

test('buildPipeline preserves operator diagnostics for admin roles', async () => {
  const service = createLibraryMediaRequestPipelineService({
    getReadableMediaRequest: async () => ({ id: 'req-1' }),
    pipelineStore: {
      listPipelineCandidates: async () => [{
        id: 'candidate-1',
        username: 'remote-peer',
        folderPath: '/private/staging/artist/album',
        candidateType: 'manual_search',
        status: 'downloading',
        fileCount: 3,
        totalSizeBytes: 1200,
        execution: {
          operationRunId: 'run-1',
          importCandidateId: 'candidate-1',
          itemStatus: 'in_progress',
          statusMessage: 'Downloading from remote-peer',
          startedAt: '2026-05-31T12:00:00.000Z',
          finishedAt: null,
          runStatus: 'running',
          runErrorMessage: '/private/staging/artist/album/private-track.flac failed',
          planningSnapshot: {
            execution: {
              latestTransferSnapshot: {
                lastReconciledAt: '2026-05-31T12:01:02.000Z',
                summary: {
                  percentComplete: 42,
                  status: 'active',
                },
              },
            },
          },
        },
        apply: null,
      }],
    },
  });

  const result = await service.buildPipeline({
    actorUserId: 'admin-1',
    actorUserRole: 'admin',
    mediaRequestId: 'req-1',
  });
  const candidate = result.candidates[0];

  assert.equal(candidate.id, 'candidate-1');
  assert.equal(candidate.sourceKey, 'candidate-1');
  assert.equal(candidate.sourceLabel, 'Source 1');
  assert.equal(candidate.username, 'remote-peer');
  assert.equal(candidate.folderPath, '/private/staging/artist/album');
  assert.equal(candidate.candidateType, 'manual_search');
  assert.deepEqual(candidate.execution, {
    operationRunId: 'run-1',
    importCandidateId: 'candidate-1',
    itemStatus: 'in_progress',
    statusMessage: 'Downloading from remote-peer',
    startedAt: '2026-05-31T12:00:00.000Z',
    finishedAt: null,
    runStatus: 'running',
    runErrorMessage: '/private/staging/artist/album/private-track.flac failed',
  });
  assert.deepEqual(candidate.transferProgress, {
    observedAt: '2026-05-31T12:01:02.000Z',
    percentComplete: 42,
    status: 'active',
  });
  assert.equal('planningSnapshot' in candidate.execution, false);
});

test('buildPipeline withholds operator diagnostics for unknown roles', async () => {
  const service = createLibraryMediaRequestPipelineService({
    getReadableMediaRequest: async () => ({ id: 'req-1' }),
    pipelineStore: {
      listPipelineCandidates: async () => [{
        id: 'candidate-1',
        username: 'remote-peer',
        folderPath: '/private/staging/artist/album',
        status: 'downloading',
        fileCount: 1,
        totalSizeBytes: 100,
        execution: {
          operationRunId: 'run-1',
          importCandidateId: 'candidate-1',
          itemStatus: 'in_progress',
          statusMessage: 'Downloading from remote-peer',
          startedAt: '2026-05-31T12:00:00.000Z',
          finishedAt: null,
          runStatus: 'running',
          runErrorMessage: 'private path failed',
          planningSnapshot: null,
        },
        apply: null,
      }],
    },
  });

  const result = await service.buildPipeline({
    actorUserId: 'user-1',
    actorUserRole: null,
    mediaRequestId: 'req-1',
  });
  const candidate = result.candidates[0];

  assert.equal(candidate.sourceLabel, 'Source 1');
  assert.equal('id' in candidate, false);
  assert.equal('username' in candidate, false);
  assert.equal('folderPath' in candidate, false);
  assert.equal('operationRunId' in candidate.execution, false);
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
