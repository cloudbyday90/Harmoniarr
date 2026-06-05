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
import { createLibraryMediaRequestPipelineStore } from '../../src/server/library/library-media-request-pipeline-store.js';

test('listPipelineCandidates returns empty without querying run items when no candidates exist', async (t) => {
  const query = t.mock.fn(async () => ({ rows: [] }));
  const store = createLibraryMediaRequestPipelineStore({ queryable: { query } });

  assert.deepEqual(await store.listPipelineCandidates({ mediaRequestId: 'req-1' }), []);
  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(query.mock.calls[0].arguments[1], ['req-1']);
});

test('listPipelineCandidates maps the latest execution snapshot and apply state', async () => {
  const planningSnapshot = {
    execution: {
      latestTransferSnapshot: {
        lastReconciledAt: '2026-05-31T12:01:02Z',
        summary: { percentComplete: 50, status: 'active' },
      },
    },
  };
  const observedSql = [];
  const queryable = {
    query: async (sql) => {
      observedSql.push(sql);
      if (sql.includes('FROM import_candidates')) {
        return {
          rows: [{
            id: 'candidate-1',
            username: 'remote-user',
            folder_path: '/music/album',
            candidate_type: 'slskd',
            status: 'downloading',
            file_count: 5,
            locked_file_count: 0,
            total_size_bytes: '1024',
            discovered_at: '2026-05-31T11:00:00Z',
            created_at: '2026-05-31T11:00:00Z',
            updated_at: '2026-05-31T12:00:00Z',
          }],
        };
      }
      if (sql.includes('import_execution_run_items')) {
        return {
          rows: [{
            operation_run_id: 'execution-run-1',
            import_candidate_id: 'candidate-1',
            item_status: 'in_progress',
            status_message: 'Downloading',
            planning_snapshot: planningSnapshot,
            started_at: '2026-05-31T12:00:00Z',
            finished_at: null,
            run_status: 'running',
            run_error_message: null,
          }],
        };
      }
      return {
        rows: [{
          operation_run_id: 'apply-run-1',
          import_candidate_id: 'candidate-1',
          item_status: 'pending',
          status_message: null,
          planning_snapshot: null,
          started_at: null,
          finished_at: null,
          run_status: 'pending',
          run_error_message: null,
        }],
      };
    },
  };
  const store = createLibraryMediaRequestPipelineStore({ queryable });

  const [candidate] = await store.listPipelineCandidates({ mediaRequestId: 'req-1' });

  assert.equal(candidate.totalSizeBytes, 1024);
  assert.equal(candidate.execution.operationRunId, 'execution-run-1');
  assert.equal(candidate.execution.planningSnapshot, planningSnapshot);
  assert.equal(candidate.apply.operationRunId, 'apply-run-1');
  assert.equal(observedSql.filter((sql) => sql.includes('ANY($1::uuid[])')).length, 2);
});

test('listPipelineCandidates keeps the first row from descending run order', async () => {
  const queryable = {
    query: async (sql) => {
      if (sql.includes('FROM import_candidates')) {
        return {
          rows: [{
            id: 'candidate-1',
            username: 'remote-user',
            folder_path: '/music/album',
            candidate_type: 'slskd',
            status: 'downloading',
            file_count: 5,
            locked_file_count: 0,
            total_size_bytes: null,
            discovered_at: null,
            created_at: null,
            updated_at: null,
          }],
        };
      }
      if (sql.includes('import_execution_run_items')) {
        return {
          rows: [
            {
              operation_run_id: 'newest-run',
              import_candidate_id: 'candidate-1',
              planning_snapshot: { sequence: 'newest' },
            },
            {
              operation_run_id: 'older-run',
              import_candidate_id: 'candidate-1',
              planning_snapshot: { sequence: 'older' },
            },
          ],
        };
      }
      return { rows: [] };
    },
  };
  const store = createLibraryMediaRequestPipelineStore({ queryable });

  const [candidate] = await store.listPipelineCandidates({ mediaRequestId: 'req-1' });

  assert.equal(candidate.execution.operationRunId, 'newest-run');
  assert.equal(candidate.execution.planningSnapshot.sequence, 'newest');
});
