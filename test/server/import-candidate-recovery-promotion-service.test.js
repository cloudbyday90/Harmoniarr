import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateRecoveryPromotionService } from '../../src/server/import-candidates/import-candidate-recovery-promotion-service.js';

test('recovery promotion locks shared selection before its conditional parent update and preserves all store guards', async () => {
  const calls = [];
  const client = {};
  const candidate = { id: 'candidate-1', status: 'held', sourceSearchId: 'search-1' };
  const input = { importCandidateId: candidate.id, maxDownloadAttemptCount: 3,
    expectedMusicQueueContext: { profileCode: 'lossless_archive' }, triggeredByFailedCandidateId: 'failed-1', reason: 'Controlled failure' };
  const service = createImportCandidateRecoveryPromotionService({ withTransaction: async (work) => work(client),
    getImportCandidateByIdFn: async (id, queryable) => { calls.push('read'); assert.equal(id, candidate.id); assert.equal(queryable, client); return candidate; },
    musicQueueSelectionGuard: { findActiveSelection: async (args) => { calls.push('discovery'); assert.equal(args.client, client); return null; } },
    promoteImportCandidateForRecoveryFn: async (args, queryable) => { calls.push('update'); assert.equal(queryable, client); assert.deepEqual(args, input); return { ...candidate, status: 'selected' }; },
  });
  assert.equal((await service.promoteRecoveryCandidate(input)).status, 'selected');
  assert.deepEqual(calls, ['read', 'discovery', 'update']);
});

test('recovery promotion returns null without a mutation for another active selection or stale candidate status', async (t) => {
  for (const [candidate, active] of [[null, null], [{ status: 'selected' }, null], [{ status: 'pending' }, { id: 'other' }]]) {
    const promote = t.mock.fn(async () => {});
    const service = createImportCandidateRecoveryPromotionService({ withTransaction: async (work) => work({}),
      getImportCandidateByIdFn: async () => candidate, musicQueueSelectionGuard: { findActiveSelection: async () => active },
      promoteImportCandidateForRecoveryFn: promote,
    });
    assert.equal(await service.promoteRecoveryCandidate({ importCandidateId: 'candidate-1' }), null);
    assert.equal(promote.mock.callCount(), 0);
  }
});

test('older search recovery supplies its trusted canonical metadata scope to the current discovery guard', async () => {
  const candidate = { id: 'older-candidate', status: 'pending', sourceSearchId: 'old-search',
    normalizedPayload: { discoveryScope: { metadataReleaseId: 'metadata-1' } } };
  const service = createImportCandidateRecoveryPromotionService({ withTransaction: async (work) => work({}),
    getImportCandidateByIdFn: async () => candidate,
    musicQueueSelectionGuard: { findActiveSelection: async (input) => { assert.equal(input.metadataReleaseId, 'metadata-1'); return { id: 'current-active' }; } },
    promoteImportCandidateForRecoveryFn: async () => { assert.fail('A current canonical selection must prevent older recovery promotion'); },
  });
  assert.equal(await service.promoteRecoveryCandidate({ importCandidateId: candidate.id }), null);
});
