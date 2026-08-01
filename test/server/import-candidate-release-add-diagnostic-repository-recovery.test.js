import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateReleaseAddDiagnosticRepository } from '../../src/server/import-candidates/import-candidate-release-add-diagnostic-repository.js';

test('release add diagnostic repository exposes only bounded blocker categories for pre-run recovery', async (t) => {
  const queryable = {
    query: t.mock.fn(async () => ({
      rows: [{
        add_blocker_code: 'media_verification',
        import_candidate_id: 'candidate-1',
        recovery_reason_code: 'audio_check_failed',
      }],
    })),
  };
  const repository = createImportCandidateReleaseAddDiagnosticRepository();

  const event = await repository.findLatestReleaseImportBlockerEvent({
    wantedReleaseId: '8f28e363-3187-48c1-bd48-0b1b613f6c9d',
  }, queryable);

  const [sql, values] = queryable.query.mock.calls[0].arguments;
  assert.match(sql, /recoveryReasonCode/);
  assert.match(sql, /events\.details ->> 'addBlockerCode'/);
  assert.deepEqual(values, ['8f28e363-3187-48c1-bd48-0b1b613f6c9d']);
  assert.deepEqual(event, {
    addBlockerCode: 'media_verification',
    importCandidateId: 'candidate-1',
    recoveryReasonCode: 'audio_check_failed',
  });
});
