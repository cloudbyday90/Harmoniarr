import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mapDatabaseError, mapDatabaseErrorWithConstraints } from '../../src/server/database-error-mapper.js';

describe('mapDatabaseError', () => {
  test('maps 23505 unique violation to 409', () => {
    const error = Object.assign(new Error('dup'), { code: '23505' });
    const mapped = mapDatabaseError(error);
    assert.equal(mapped.status, 409);
    assert.equal(mapped.code, 'conflict');
    assert.equal(mapped.message, 'Resource already exists');
  });

  test('maps 23503 FK violation to 422', () => {
    const error = Object.assign(new Error('fk'), { code: '23503' });
    const mapped = mapDatabaseError(error);
    assert.equal(mapped.status, 422);
    assert.equal(mapped.code, 'fk_violation');
  });

  test('maps 23502 NOT NULL violation to 422', () => {
    const error = Object.assign(new Error('null'), { code: '23502' });
    const mapped = mapDatabaseError(error);
    assert.equal(mapped.status, 422);
    assert.equal(mapped.code, 'validation_error');
  });

  test('returns original error for unknown pg code', () => {
    const error = Object.assign(new Error('unknown'), { code: '12345' });
    const result = mapDatabaseError(error);
    assert.equal(result, error);
  });

  test('returns original error when code is absent', () => {
    const error = new Error('no code');
    const result = mapDatabaseError(error);
    assert.equal(result, error);
  });

  test('returns original error for null input', () => {
    const result = mapDatabaseError(null);
    assert.equal(result, null);
  });
});

describe('mapDatabaseErrorWithConstraints', () => {
  const constraintMap = {
    users_email_unique: {
      code: 'email_conflict',
      message: 'Email already in use',
    },
    users_username_unique: {
      code: 'username_conflict',
      message: 'Username taken',
      status: 409,
    },
  };

  const mapper = mapDatabaseErrorWithConstraints(constraintMap);

  test('maps known constraint to custom error', () => {
    const error = Object.assign(new Error('dup'), { code: '23505', constraint: 'users_email_unique' });
    const mapped = mapper(error);
    assert.equal(mapped.status, 409);
    assert.equal(mapped.code, 'email_conflict');
    assert.equal(mapped.message, 'Email already in use');
  });

  test('maps another known constraint with explicit status', () => {
    const error = Object.assign(new Error('dup'), { code: '23505', constraint: 'users_username_unique' });
    const mapped = mapper(error);
    assert.equal(mapped.status, 409);
    assert.equal(mapped.code, 'username_conflict');
  });

  test('falls back to generic mapDatabaseError for unknown constraint', () => {
    const error = Object.assign(new Error('dup'), { code: '23505', constraint: 'unknown_constraint' });
    const mapped = mapper(error);
    assert.equal(mapped.status, 409);
    assert.equal(mapped.code, 'conflict');
  });

  test('falls back for non-23505 errors', () => {
    const error = Object.assign(new Error('fk'), { code: '23503' });
    const mapped = mapper(error);
    assert.equal(mapped.status, 422);
    assert.equal(mapped.code, 'fk_violation');
  });
});
