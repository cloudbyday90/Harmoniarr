import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExternalRequestSearchDiagnostics as build } from '../../src/client/lib/external-request-search-diagnostics-presentation.js';

const base = { provider: 'slskd', candidateCount: 0, responseCount: 3, responseFileCount: 5 };
test('observed causes retain separate units and only verified internal review destinations', () => {
  const result = build({ ...base, ignoredUserResponseCount: 1, blacklistedFileCount: 2,
    missingUsernameResponseCount: 1, malformedFileCount: 1, reasonCodes: ['private'], username: 'private-peer' });
  assert.equal(result.details.length, 4);
  assert.match(result.summary, /3 provider responses included 5 files/);
  assert.deepEqual(result.links.map(link => link.to.name), ['activity-ignored', 'settings-connections']);
  assert.match(result.details[0], /1 response excluded/);
  assert.match(result.details[1], /2 files excluded/);
  assert.doesNotMatch(JSON.stringify(result), /private|quality|Search again/);
});
test('unknown causes and fileless responses remain truthful without inferred quality rejection', () => {
  assert.equal(build(null), null);
  assert.equal(build({ ...base, candidateCount: 1 }), null);
  assert.match(build(base).details[0], /does not identify why/);
  const empty = build({ provider: 'slskd', candidateCount: 0, responseCount: 1, responseFileCount: 0 });
  assert.match(empty.summary, /1 provider response included 0 files/);
  assert.deepEqual(empty.details, ['The provider responses contained no files.']);
});
