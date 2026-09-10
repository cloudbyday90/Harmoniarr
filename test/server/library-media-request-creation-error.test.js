import assert from 'node:assert/strict';
import test from 'node:test';
import { createApiError } from '../../src/server/auth.js';
import { normalizeMediaRequestCreationError } from '../../src/server/library/library-media-request-creation-error.js';

test('request creation errors hide database details and preserve the internal cause', () => {
  const original = Object.assign(new Error('audit_events violates secret_constraint /private/data'), { code: '23514' });
  const error = normalizeMediaRequestCreationError(original);
  assert.equal(error.status, 500);
  assert.equal(error.code, 'media_request_creation_failed');
  assert.equal(error.cause, original);
  assert.doesNotMatch(error.message, /audit_events|secret_constraint|private/u);
  assert.match(error.message, /Check your requests/u);
});

test('request creation preserves explicit validation and maintenance policy errors', () => {
  for (const code of ['validation_error', 'forbidden', 'recovery_lock_conflict', 'media_request_target_ineligible']) {
    const error = createApiError(409, code, 'Public policy message');
    assert.equal(normalizeMediaRequestCreationError(error), error);
  }
});

test('request creation maps connection and reference failures to bounded public errors', () => {
  for (const [code, expectedCode, expectedStatus] of [
    ['ECONNREFUSED', 'database_unavailable', 503],
    ['23503', 'fk_violation', 422],
    ['23505', 'conflict', 409],
  ]) {
    const error = normalizeMediaRequestCreationError(Object.assign(new Error('private details'), { code }));
    assert.equal(error.code, expectedCode);
    assert.equal(error.status, expectedStatus);
    assert.doesNotMatch(error.message, /private details/u);
  }
});
