import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { mapDatabaseError, mapDatabaseErrorWithConstraints, normalizeDatabaseConnectionError } from '../../src/server/database-error-mapper.js';

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

describe('normalizeDatabaseConnectionError', () => {
  test('maps ECONNREFUSED to 503', () => {
    const error = Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' });
    const mapped = normalizeDatabaseConnectionError(error);
    assert.equal(mapped.status, 503);
    assert.equal(mapped.code, 'database_unavailable');
  });

  test('maps ECONNRESET to 503', () => {
    const error = Object.assign(new Error('connection reset'), { code: 'ECONNRESET' });
    const mapped = normalizeDatabaseConnectionError(error);
    assert.equal(mapped.status, 503);
  });

  test('maps ENOTFOUND to 503', () => {
    const error = Object.assign(new Error('not found'), { code: 'ENOTFOUND' });
    const mapped = normalizeDatabaseConnectionError(error);
    assert.equal(mapped.status, 503);
  });

  test('maps ETIMEDOUT to 503', () => {
    const error = Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' });
    const mapped = normalizeDatabaseConnectionError(error);
    assert.equal(mapped.status, 503);
  });

  test('maps 57P01 admin shutdown to 503', () => {
    const error = Object.assign(new Error('admin shutdown'), { code: '57P01' });
    const mapped = normalizeDatabaseConnectionError(error);
    assert.equal(mapped.status, 503);
  });

  test('maps 57P03 starting up to 503', () => {
    const error = Object.assign(new Error('starting up'), { code: '57P03' });
    const mapped = normalizeDatabaseConnectionError(error);
    assert.equal(mapped.status, 503);
  });

  test('maps 08006 connection failure to 503', () => {
    const error = Object.assign(new Error('connection failure'), { code: '08006' });
    const mapped = normalizeDatabaseConnectionError(error);
    assert.equal(mapped.status, 503);
  });

  test('maps syscall=connect errors to 503', () => {
    const error = Object.assign(new Error('connect failed'), { code: 'SOME_OTHER', syscall: 'connect' });
    const mapped = normalizeDatabaseConnectionError(error);
    assert.equal(mapped.status, 503);
  });

  test('returns original error for non-connection errors', () => {
    const error = new Error('some query error');
    const result = normalizeDatabaseConnectionError(error);
    assert.equal(result, error);
  });

  test('returns original error for application errors with status', () => {
    const error = Object.assign(new Error('not found'), { status: 404, code: 'not_found' });
    const result = normalizeDatabaseConnectionError(error);
    assert.equal(result, error);
  });

  test('returns null for null input', () => {
    const result = normalizeDatabaseConnectionError(null);
    assert.equal(result, null);
  });
});
