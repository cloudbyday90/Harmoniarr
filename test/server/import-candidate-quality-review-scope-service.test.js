/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { createImportCandidateQualityReviewScopeService } from '../../src/server/import-candidates/import-candidate-quality-review-scope-service.js';

const id = index => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const wantedId = id(900); const ownerId = id(901); const failedId = id(999);
function fixture({ weak = 51, eligible = 15, disabled = false, alternative = null } = {}) {
  const context = { profileCode: 'lossless_archive', wantedReleaseId: wantedId };
  const failed = { id: failedId, status: 'failed', sourceSearchId: 'current-search', normalizedPayload: { musicQueue: context } };
  const candidates = Array.from({ length: weak + eligible }, (_, index) => ({ id: id(index + 1), status: 'pending',
    sourceSearchId: 'current-search', fileCount: 1, totalSizeBytes: 5000,
    normalizedPayload: { musicQueue: context, extensions: [index < weak ? 'mp3' : 'flac'] } }));
  const reads = []; const pages = []; const locks = []; let scopeReads = 0; let transactions = 0;
  const service = createImportCandidateQualityReviewScopeService({
    recheckStore: {
      readOwnedRelease: async () => { scopeReads++; return { metadataReleaseId: id(902), targetUser: { isDisabled: disabled },
        libraryAddRecoveryFacts: { candidateId: failedId, candidateStatus: 'failed', addBlockerCode: 'media_verification',
          recoveryReasonCode: 'suspicious_lossless', hasConflictingCandidate: false, activeRunId: null } }; },
      readParticipantPolicies: async () => [{ wantedReleaseId: wantedId, appUserId: ownerId, metadataReleaseId: id(902),
        discoveryLinkExists: true, wantedStatus: 'missing', missingTrackCount: 1, isDisabled: false,
        qualityPreferences: { minimumQuality: 'lossless', preferredFormat: 'flac' } }],
      readSelectionActor: async () => ({ id: ownerId }), lockCandidate: async input => { locks.push(input); }, lockParticipantReleases: async () => {},
    },
    candidateStore: { listCandidatePage: async input => {
      pages.push(input);
      const rows = candidates.filter(row => !input.afterId || (input.direction === 'previous'
        ? input.inclusive ? row.id <= input.afterId : row.id < input.afterId
        : input.inclusive ? row.id >= input.afterId : row.id > input.afterId));
      return (input.direction === 'previous' ? rows.reverse() : rows).slice(0, 50);
    } },
    getImportCandidate: async ({ importCandidateId }) => {
      reads.push(importCandidateId);
      if (alternative && importCandidateId === alternative.id) return alternative;
      assert.equal(importCandidateId, failedId, 'Read-side scans must not load alternative detail or files'); return failed;
    },
    assertMaintenanceWriteAllowed: async () => {},
    withTransaction: async () => { transactions++; assert.fail('An ineligible foreign candidate cannot open a write transaction'); },
  });
  return { service, reads, pages, locks, transactions: () => transactions, scopeReads: () => scopeReads };
}

test('one scope and two batch reads expose twelve eligible choices beyond fifty ineligible rows without per-candidate detail', async () => {
  const f = fixture(); const result = await f.service.getQualityReviewAlternatives({ appUserId: ownerId, wantedReleaseId: wantedId });
  assert.deepEqual(result.candidates.map(row => row.id), Array.from({ length: 12 }, (_, index) => id(index + 52)));
  assert.equal(result.canSearchAgain, false); assert.equal(f.scopeReads(), 1); assert.deepEqual(f.reads, [failedId]);
  assert.equal(f.pages.length, 2); assert.equal(f.pages[0].afterId, null); assert.equal(f.pages[1].afterId, id(50));
});

test('empty eligible results require complete batch traversal and an invalid scope cannot imply exhaustion', async () => {
  const f = fixture({ weak: 100, eligible: 0 });
  assert.deepEqual(await f.service.getQualityReviewAlternatives({ appUserId: ownerId, wantedReleaseId: wantedId }), { candidates: [], canSearchAgain: true });
  assert.equal(f.pages.length, 3); assert.deepEqual(f.reads, [failedId]);
  const disabled = fixture({ disabled: true });
  assert.deepEqual(await disabled.service.getQualityReviewAlternatives({ appUserId: ownerId, wantedReleaseId: wantedId }), { candidates: [], canSearchAgain: false });
  assert.equal(disabled.pages.length, 0);
});

test('forward and reverse pages retain twelve eligible facts without repeating a fixed candidate set', async () => {
  const f = fixture({ weak: 100, eligible: 25 }); const input = { appUserId: ownerId, wantedReleaseId: wantedId };
  const first = await f.service.getQualityReviewAlternatives(input);
  const second = await f.service.getQualityReviewAlternatives({ ...input, matchCursor: first.matchChoicePage.nextCursor });
  const third = await f.service.getQualityReviewAlternatives({ ...input, matchCursor: second.matchChoicePage.nextCursor });
  assert.equal(first.matchChoicePage.previousCursor, null); assert.equal(third.matchChoicePage.nextCursor, null);
  assert.deepEqual([...first.candidates, ...second.candidates, ...third.candidates].map(c => c.id), Array.from({ length: 25 }, (_, n) => id(101 + n)));
  const back = await f.service.getQualityReviewAlternatives({ ...input, matchCursor: third.matchChoicePage.previousCursor });
  assert.deepEqual(back.candidates, second.candidates);
  const start = await f.service.getQualityReviewAlternatives({ ...input, matchCursor: back.matchChoicePage.previousCursor });
  assert.deepEqual(start.candidates, first.candidates); assert.equal(start.matchChoicePage.previousCursor, null);
  assert.equal(third.canSearchAgain, false); assert.deepEqual(f.reads, Array(5).fill(failedId));
});

test('guarded existence checks use the same batches, preserve the owning queryable and stop at the first eligible result', async () => {
  const f = fixture({ weak: 0, eligible: 90 }); const queryable = { query: () => {} };
  const scope = await f.service.readScope({ appUserId: ownerId, wantedReleaseId: wantedId });
  assert.equal(await f.service.hasEligibleAlternative(scope, { queryable }), true);
  assert.equal(f.pages.length, 1); assert.equal(f.pages[0].queryable, queryable); assert.deepEqual(f.reads, [failedId]);
});

test('empty bounded windows continue explicitly and cannot authorize restart before a hidden eligible choice', async () => {
  const f = fixture({ weak: 401, eligible: 1 }); const input = { appUserId: ownerId, wantedReleaseId: wantedId };
  const first = await f.service.getQualityReviewAlternatives(input);
  assert.equal(f.pages.length, 4); assert.deepEqual(first.candidates, []); assert.equal(first.canSearchAgain, false);
  assert.equal(first.matchChoicePage.scanIncomplete, true); assert.ok(first.matchChoicePage.nextCursor);
  const second = await f.service.getQualityReviewAlternatives({ ...input, matchCursor: first.matchChoicePage.nextCursor });
  assert.equal(f.pages.length, 8); assert.deepEqual(second.candidates, []); assert.equal(second.canSearchAgain, false);
  const third = await f.service.getQualityReviewAlternatives({ ...input, matchCursor: second.matchChoicePage.nextCursor });
  assert.deepEqual(third.candidates.map(c => c.id), [id(402)]); assert.equal(third.matchChoicePage.scanIncomplete, false);
  assert.equal(third.canSearchAgain, false); assert.equal(f.pages.length, 9);
  const scope = await f.service.readScope(input);
  assert.equal(await f.service.hasEligibleAlternative(scope), true, 'The command guard must find choices beyond the read budget');
});

test('exact-boundary empty walks require later EOF and an empty terminal page can return to its boundary match', async () => {
  const input = { appUserId: ownerId, wantedReleaseId: wantedId };
  const empty = fixture({ weak: 200, eligible: 0 }); const first = await empty.service.getQualityReviewAlternatives(input);
  assert.equal(first.canSearchAgain, false); assert.equal(first.matchChoicePage.scanIncomplete, true);
  const end = await empty.service.getQualityReviewAlternatives({ ...input, matchCursor: first.matchChoicePage.nextCursor });
  assert.equal(end.canSearchAgain, true); assert.equal(end.matchChoicePage.scanIncomplete, false); assert.equal(end.matchChoicePage.nextCursor, null);
  const reverse = await empty.service.getQualityReviewAlternatives({ ...input, matchCursor: end.matchChoicePage.previousCursor });
  assert.equal(reverse.canSearchAgain, false); assert.equal(reverse.matchChoicePage.scanDirection, 'previous');
  const choice = fixture({ weak: 199, eligible: 1 }); const offered = await choice.service.getQualityReviewAlternatives(input);
  assert.deepEqual(offered.candidates.map(c => c.id), [id(200)]); assert.equal(offered.matchChoicePage.scanIncomplete, true);
  const tail = await choice.service.getQualityReviewAlternatives({ ...input, matchCursor: offered.matchChoicePage.nextCursor });
  assert.equal(tail.canSearchAgain, false); assert.deepEqual(tail.candidates, []);
  const back = await choice.service.getQualityReviewAlternatives({ ...input, matchCursor: tail.matchChoicePage.previousCursor });
  assert.deepEqual(back.candidates.map(c => c.id), [id(200)]);
});

test('foreign candidate scope is refused before taking candidate locks or opening a write transaction', async () => {
  const alternative = { id: id(500), status: 'pending', sourceSearchId: 'foreign-search',
    normalizedPayload: { musicQueue: { profileCode: 'lossless_archive', wantedReleaseId: wantedId }, extensions: ['flac'] } };
  const f = fixture({ alternative });
  await assert.rejects(f.service.withCurrentScope({ appUserId: ownerId, actorUserId: ownerId, wantedReleaseId: wantedId,
    importCandidateId: alternative.id }, async () => assert.fail('Foreign scope cannot reach mutation')), error => error.code === 'missing_music_match_changed');
  assert.deepEqual(f.reads, [failedId, alternative.id]); assert.equal(f.transactions(), 0); assert.deepEqual(f.locks, []);
});
