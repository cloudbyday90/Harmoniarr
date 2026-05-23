import assert from 'node:assert/strict';
import test from 'node:test';
import { createLibraryMediaRequestPipelineService } from '../../src/server/library/library-media-request-pipeline-service.js';

function createMockQueryable(rows = []) {
  const queryCalls = [];
  const queryable = {
    query: async (sql, params) => {
      queryCalls.push({ params, sql });
      return { rows };
    },
    queryCalls,
  };
  return queryable;
}

test('buildPipeline returns empty candidates when mediaRequestId is falsy', async () => {
  const queryable = createMockQueryable();
  const service = createLibraryMediaRequestPipelineService({ queryable });
  const result = await service.buildPipeline({ mediaRequestId: '' });
  assert.deepEqual(result, { candidates: [] });
  assert.equal(queryable.queryCalls.length, 0);
});

test('buildPipeline returns empty candidates when no import candidates exist', async () => {
  const queryable = createMockQueryable([]);
  const service = createLibraryMediaRequestPipelineService({ queryable });
  const result = await service.buildPipeline({ mediaRequestId: 'req-1' });
  assert.deepEqual(result, { candidates: [] });
  assert.equal(queryable.queryCalls.length, 1);
});

test('buildPipeline maps candidate rows without run data', async () => {
  const candidateRows = [
    {
      id: 'cand-1',
      username: 'user1',
      folder_path: '/music/album',
      candidate_type: 'slskd',
      status: 'pending',
      file_count: 10,
      locked_file_count: 0,
      total_size_bytes: 1024000,
      discovered_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ];

  let queryIndex = 0;
  const queryable = {
    query: async (sql, params) => {
      queryIndex += 1;
      if (queryIndex === 1) return { rows: candidateRows };
      return { rows: [] };
    },
  };

  const service = createLibraryMediaRequestPipelineService({ queryable });
  const result = await service.buildPipeline({ mediaRequestId: 'req-1' });

  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].id, 'cand-1');
  assert.equal(result.candidates[0].username, 'user1');
  assert.equal(result.candidates[0].status, 'pending');
  assert.equal(result.candidates[0].fileCount, 10);
  assert.equal(result.candidates[0].totalSizeBytes, 1024000);
  assert.equal(result.candidates[0].execution, null);
  assert.equal(result.candidates[0].apply, null);
});

test('buildPipeline maps execution and apply run items to candidates', async () => {
  const candidateRows = [
    {
      id: 'cand-1',
      username: 'user1',
      folder_path: '/music/album',
      candidate_type: 'slskd',
      status: 'downloading',
      file_count: 5,
      locked_file_count: 0,
      total_size_bytes: null,
      discovered_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-02T00:00:00Z',
    },
  ];

  const executionRows = [
    {
      operation_run_id: 'run-exec-1',
      import_candidate_id: 'cand-1',
      item_status: 'in_progress',
      status_message: 'Downloading 3 of 5 files',
      started_at: '2026-01-02T10:00:00Z',
      finished_at: null,
      run_status: 'running',
      run_error_message: null,
    },
  ];

  const applyRows = [
    {
      operation_run_id: 'run-apply-1',
      import_candidate_id: 'cand-1',
      item_status: 'pending',
      status_message: null,
      started_at: null,
      finished_at: null,
      run_status: 'pending',
      run_error_message: null,
    },
  ];

  let queryIndex = 0;
  const queryable = {
    query: async (sql, params) => {
      queryIndex += 1;
      if (queryIndex === 1) return { rows: candidateRows };
      if (sql.includes('import_execution_run_items')) return { rows: executionRows };
      return { rows: applyRows };
    },
  };

  const service = createLibraryMediaRequestPipelineService({ queryable });
  const result = await service.buildPipeline({ mediaRequestId: 'req-1' });

  assert.equal(result.candidates.length, 1);
  const candidate = result.candidates[0];

  assert.equal(candidate.execution.operationRunId, 'run-exec-1');
  assert.equal(candidate.execution.itemStatus, 'in_progress');
  assert.equal(candidate.execution.statusMessage, 'Downloading 3 of 5 files');
  assert.equal(candidate.execution.runStatus, 'running');

  assert.equal(candidate.apply.operationRunId, 'run-apply-1');
  assert.equal(candidate.apply.itemStatus, 'pending');
  assert.equal(candidate.apply.runStatus, 'pending');
});

test('buildPipeline picks most recent run item per candidate', async () => {
  const candidateRows = [
    {
      id: 'cand-1',
      username: 'user1',
      folder_path: '/music/album',
      candidate_type: 'slskd',
      status: 'applied',
      file_count: 3,
      locked_file_count: 0,
      total_size_bytes: 500000,
      discovered_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-03T00:00:00Z',
    },
  ];

  const executionRows = [
    {
      operation_run_id: 'run-exec-old',
      import_candidate_id: 'cand-1',
      item_status: 'completed',
      status_message: null,
      started_at: '2026-01-01T00:00:00Z',
      finished_at: '2026-01-01T01:00:00Z',
      run_status: 'completed',
      run_error_message: null,
    },
    {
      operation_run_id: 'run-exec-new',
      import_candidate_id: 'cand-1',
      item_status: 'completed',
      status_message: null,
      started_at: '2026-01-02T00:00:00Z',
      finished_at: '2026-01-02T01:00:00Z',
      run_status: 'completed',
      run_error_message: null,
    },
  ];

  let queryIndex = 0;
  const queryable = {
    query: async (sql, params) => {
      queryIndex += 1;
      if (queryIndex === 1) return { rows: candidateRows };
      if (sql.includes('import_execution_run_items')) return { rows: executionRows };
      return { rows: [] };
    },
  };

  const service = createLibraryMediaRequestPipelineService({ queryable });
  const result = await service.buildPipeline({ mediaRequestId: 'req-1' });

  assert.equal(result.candidates[0].execution.operationRunId, 'run-exec-old',
    'should pick the first (most recent by DESC sort) run item');
});
