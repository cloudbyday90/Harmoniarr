import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSlskdSearchDiagnosticsPresentation as build } from '../../src/client/lib/slskd-search-diagnostics-presentation.js';
import { buildDiscoveryDispatchResult } from '../../src/client/lib/wanted-release-normalization.js';

const counts = { provider: 'slskd', candidateCount: 0, responseCount: 4, responseFileCount: 10,
  ignoredUserResponseCount: 2, missingUsernameResponseCount: 1, blacklistedFileCount: 3, malformedFileCount: 2 };
test('mixed causes retain separate units and never become a combined filtered total or raw reason', () => {
  const input = { ...counts, reasonCodes: ['private reason'], username: 'private-peer', query: 'secret' };
  const result = build(input);
  assert.deepEqual(result.details, [
    { label: 'Provider responses', value: '4' }, { label: 'Provider files', value: '10' },
    { label: 'Ignored-source responses', value: '2' }, { label: 'Files excluded by title', value: '3' },
    { label: 'Responses missing identity', value: '1' }, { label: 'Malformed files', value: '2' },
  ]);
  const advanced = buildDiscoveryDispatchResult({ discoveryRequest: { requestStatus: 'cooldown',
    evidence: { lastSearchResult: { candidateCount: 0, fileCount: 0, ingestionDiagnostics: input } } } });
  assert.deepEqual(advanced.details, result.details);
  assert.doesNotMatch(JSON.stringify(advanced), /private|secret|Filtered|quality/);
});
test('recorded zero, missing evidence and unsupported reason strings remain distinct', () => {
  const zero = { provider: 'slskd', candidateCount: 0, responseCount: 0, responseFileCount: 0 };
  assert.deepEqual(build(zero).details.slice(0, 2), [{ label: 'Provider responses', value: '0' }, { label: 'Provider files', value: '0' }]);
  assert.equal(build({ ...zero, responseFileCount: 1 }), null);
  assert.equal(build({ provider: 'slskd', candidateCount: 0, reasonCodes: ['no_provider_responses'] }), null);
  assert.equal(build({ ...counts, responseCount: '4' }), null);
  assert.equal(build({ ...counts, malformedFileCount: Infinity }), null);
});
