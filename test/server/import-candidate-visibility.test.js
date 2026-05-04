import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertImportCandidateVisible,
  buildImportCandidateVisibilityFilter,
  canViewImportCandidate,
  resolveImportCandidateRequestOwnership,
} from '../../src/server/import-candidates/import-candidate-visibility.js';

function createCandidate(requestOwnership = null) {
  return {
    id: 'candidate-1',
    normalizedPayload: {
      requestOwnership,
    },
  };
}

test('resolveImportCandidateRequestOwnership normalizes delegated request ownership', () => {
  assert.deepEqual(resolveImportCandidateRequestOwnership(createCandidate({
    sourceMediaRequestId: ' request-1 ',
    sourceRequestKind: ' release ',
    sourceRequestedByUserId: ' admin-1 ',
    sourceRequestedForUserId: ' user-7 ',
    sourceType: ' media_request ',
  })), {
    sourceMediaRequestId: 'request-1',
    sourceRequestKind: 'release',
    sourceRequestedByUserId: 'admin-1',
    sourceRequestedForUserId: 'user-7',
    sourceType: 'media_request',
  });
});

test('buildImportCandidateVisibilityFilter scopes non-admin reads to the delegated target', () => {
  assert.deepEqual(buildImportCandidateVisibilityFilter({
    actorUserId: 'user-7',
    actorUserRole: 'user',
  }), {
    requestedForUserId: 'user-7',
  });
  assert.deepEqual(buildImportCandidateVisibilityFilter({
    actorUserId: 'user-7',
    actorUserRole: 'admin',
  }), {
    requestedForUserId: null,
  });
});

test('canViewImportCandidate allows admins and the delegated target user only', () => {
  const delegatedCandidate = createCandidate({
    sourceRequestedByUserId: 'admin-1',
    sourceRequestedForUserId: 'user-7',
    sourceType: 'media_request',
  });

  assert.equal(canViewImportCandidate({
    actorUserId: 'admin-1',
    actorUserRole: 'admin',
    candidate: delegatedCandidate,
  }), true);
  assert.equal(canViewImportCandidate({
    actorUserId: 'user-7',
    actorUserRole: 'user',
    candidate: delegatedCandidate,
  }), true);
  assert.equal(canViewImportCandidate({
    actorUserId: 'user-8',
    actorUserRole: 'user',
    candidate: delegatedCandidate,
  }), false);
  assert.equal(canViewImportCandidate({
    actorUserId: 'user-7',
    actorUserRole: 'user',
    candidate: createCandidate(),
  }), false);
});

test('assertImportCandidateVisible fails closed with not-found semantics', () => {
  assert.throws(() => assertImportCandidateVisible({
    actorUserId: 'user-8',
    actorUserRole: 'user',
    candidate: createCandidate({
      sourceRequestedForUserId: 'user-7',
    }),
  }), (error) => {
    assert.equal(error.status, 404);
    assert.equal(error.code, 'import_candidate_not_found');
    return true;
  });
});