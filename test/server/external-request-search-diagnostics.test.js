import assert from 'node:assert/strict';
import test from 'node:test';
import { projectExternalRequestSearchDiagnostics as project } from '../../src/shared/external-request-search-diagnostics.js';

const diagnostics = { provider: 'slskd', candidateCount: 0, responseCount: 3, responseFileCount: 5,
  ignoredUserResponseCount: 1, blacklistedFileCount: 2, malformedFileCount: 1, missingUsernameResponseCount: 1 };

test('external diagnostic projection is bounded, idempotent and drops private or supplied reason text', () => {
  const projected = project({ ...diagnostics, username: 'private-peer', filename: '/private/music', query: 'private-query',
    reasonCodes: ['<script>private</script>'], nested: { token: 'secret' }, error: 'private-error' });
  assert.deepEqual(projected, diagnostics);
  assert.deepEqual(project(projected), projected);
  assert.doesNotMatch(JSON.stringify(projected), /private|secret|script/);
});

test('success, unknown counts, empty searches and inconsistent evidence cannot become filtering diagnostics', () => {
  for (const invalid of [null, {}, { ...diagnostics, provider: 'unknown' }, { ...diagnostics, candidateCount: 1 },
    { ...diagnostics, responseCount: 0 }, { ...diagnostics, responseCount: '3' },
    { ...diagnostics, responseFileCount: -1 }, { ...diagnostics, responseFileCount: Infinity },
    { ...diagnostics, responseCount: Number.MAX_SAFE_INTEGER + 1 },
    { ...diagnostics, ignoredUserResponseCount: 4 }, { ...diagnostics, missingUsernameResponseCount: 4 },
    { ...diagnostics, blacklistedFileCount: 6 }, { ...diagnostics, malformedFileCount: 6 }]) {
    assert.equal(project(invalid), null);
  }
  assert.equal(project({ provider: 'slskd', candidateCount: 0, responseCount: 1 }), null);
  assert.deepEqual(project({ provider: 'slskd', candidateCount: 0, responseCount: 1, responseFileCount: 0 }), {
    provider: 'slskd', candidateCount: 0, responseCount: 1, responseFileCount: 0,
    ignoredUserResponseCount: 0, blacklistedFileCount: 0, malformedFileCount: 0, missingUsernameResponseCount: 0,
  });
});
