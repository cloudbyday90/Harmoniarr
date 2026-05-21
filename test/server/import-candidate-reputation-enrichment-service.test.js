import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateReputationEnrichmentService } from '../../src/server/import-candidates/import-candidate-reputation-enrichment-service.js';

function createCandidate(overrides = {}) {
  return {
    id: 'candidate-1',
    username: 'Uploader1',
    folderPath: 'Artist\\Album',
    status: 'pending',
    fileCount: 5,
    ...overrides,
  };
}

test('enrichCandidatesWithUploaderReputation enriches candidates with uploader reputation data', async () => {
  const reputationIndex = new Map([
    ['uploader1', {
      trustState: 'neutral',
      successCount: 8,
      failureCount: 2,
    }],
  ]);

  const service = createImportCandidateReputationEnrichmentService({
    listSourceUserReputationIndexFn: async () => reputationIndex,
  });

  const candidates = [createCandidate({ username: 'Uploader1' })];
  const enriched = await service.enrichCandidatesWithUploaderReputation(candidates);

  assert.equal(enriched.length, 1);
  assert.equal(enriched[0].id, 'candidate-1');
  assert.ok(enriched[0].uploaderReputation);
  assert.equal(enriched[0].uploaderReputation.trustState, 'neutral');
  assert.equal(enriched[0].uploaderReputation.successCount, 8);
  assert.equal(enriched[0].uploaderReputation.failureCount, 2);
  assert.equal(enriched[0].uploaderReputation.evidenceCount, 10);
  assert.equal(enriched[0].uploaderReputation.reliability, 'good');
  assert.ok(enriched[0].uploaderReputation.successRate > 0);
});

test('enrichCandidatesWithUploaderReputation sets null reputation for unknown uploaders', async () => {
  const service = createImportCandidateReputationEnrichmentService({
    listSourceUserReputationIndexFn: async () => new Map(),
  });

  const candidates = [createCandidate({ username: 'NewUploader' })];
  const enriched = await service.enrichCandidatesWithUploaderReputation(candidates);

  assert.equal(enriched.length, 1);
  assert.equal(enriched[0].uploaderReputation, null);
});

test('enrichCandidatesWithUploaderReputation returns empty array for empty input', async () => {
  const service = createImportCandidateReputationEnrichmentService({
    listSourceUserReputationIndexFn: async () => new Map(),
  });

  const enriched = await service.enrichCandidatesWithUploaderReputation([]);
  assert.deepEqual(enriched, []);
});

test('enrichCandidatesWithUploaderReputation handles reputation lookup failure gracefully', async () => {
  const service = createImportCandidateReputationEnrichmentService({
    listSourceUserReputationIndexFn: async () => { throw new Error('trust store unavailable'); },
  });

  const candidates = [createCandidate()];
  const enriched = await service.enrichCandidatesWithUploaderReputation(candidates);

  assert.equal(enriched.length, 1);
  assert.equal(enriched[0].uploaderReputation, null);
});

test('enrichCandidatesWithUploaderReputation resolves blocked uploader review state', async () => {
  const reputationIndex = new Map([
    ['blockeduser', {
      trustState: 'blocked',
      successCount: 0,
      failureCount: 5,
    }],
  ]);

  const service = createImportCandidateReputationEnrichmentService({
    listSourceUserReputationIndexFn: async () => reputationIndex,
  });

  const candidates = [createCandidate({ username: 'BlockedUser' })];
  const enriched = await service.enrichCandidatesWithUploaderReputation(candidates);

  assert.equal(enriched[0].uploaderReputation.trustState, 'blocked');
  assert.equal(enriched[0].uploaderReputation.reliability, 'poor');
});

test('buildCandidateReputationSummary aggregates reputation counts', async () => {
  const service = createImportCandidateReputationEnrichmentService({
    listSourceUserReputationIndexFn: async () => new Map(),
  });

  const enrichedCandidates = [
    { uploaderReputation: { reviewState: 'excluded', trustState: 'blocked', evidenceCount: 5, successCount: 0, failureCount: 5 } },
    { uploaderReputation: { reviewState: 'preferred', trustState: 'trusted', evidenceCount: 10, successCount: 9, failureCount: 1 } },
    { uploaderReputation: { reviewState: 'watch', trustState: 'neutral', evidenceCount: 3, successCount: 1, failureCount: 2 } },
    { uploaderReputation: { reviewState: 'unknown', trustState: 'neutral', evidenceCount: 0, successCount: 0, failureCount: 0 } },
    { uploaderReputation: { reviewState: 'healthy', trustState: 'neutral', evidenceCount: 8, successCount: 7, failureCount: 1 } },
    { uploaderReputation: null },
  ];

  const summary = service.buildCandidateReputationSummary(enrichedCandidates);

  assert.equal(summary.total, 6);
  assert.equal(summary.fromBlockedUploaders, 1);
  assert.equal(summary.fromPreferredUploaders, 1);
  assert.equal(summary.fromWatchUploaders, 1);
  assert.equal(summary.fromUnknownUploaders, 2);
  assert.equal(summary.withReputation, 4);
});

test('buildCandidateReputationSummary returns empty counts for empty input', () => {
  const service = createImportCandidateReputationEnrichmentService();
  const summary = service.buildCandidateReputationSummary([]);

  assert.equal(summary.total, 0);
  assert.equal(summary.fromBlockedUploaders, 0);
  assert.equal(summary.fromPreferredUploaders, 0);
  assert.equal(summary.fromWatchUploaders, 0);
  assert.equal(summary.fromUnknownUploaders, 0);
  assert.equal(summary.withReputation, 0);
});
