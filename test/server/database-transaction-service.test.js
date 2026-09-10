/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import assert from 'node:assert/strict';
import test from 'node:test';
import { createDatabaseTransactionRunner } from '../../src/server/database-transaction-service.js';

function createTransactionFixture({ queryFailures = {} } = {}) {
  const queries = [];
  const releases = [];
  const client = {
    async query(statement, parameters) {
      queries.push({ statement, parameters });
      if (queryFailures[statement]) throw queryFailures[statement];
      return { rows: [] };
    },
    release(error) {
      releases.push(error);
    },
  };
  const withTransaction = createDatabaseTransactionRunner({
    getPoolFn: () => ({ connect: async () => client }),
  });
  return { client, queries, releases, withTransaction };
}

test('database transaction commits work on its checked-out client before returning its result', async () => {
  const fixture = createTransactionFixture();
  const expectedResult = { requestId: 'request-1' };
  const result = await fixture.withTransaction(async (queryable) => {
    assert.equal(queryable, fixture.client);
    assert.equal(fixture.releases.length, 0);
    await queryable.query('INSERT INTO requests VALUES ($1)', ['request-1']);
    return expectedResult;
  });

  assert.equal(result, expectedResult);
  assert.deepEqual(fixture.queries, [
    { statement: 'BEGIN', parameters: undefined },
    { statement: 'INSERT INTO requests VALUES ($1)', parameters: ['request-1'] },
    { statement: 'COMMIT', parameters: undefined },
  ]);
  assert.deepEqual(fixture.releases, [undefined]);
});

for (const failedStatement of ['BEGIN', 'INSERT INTO requests VALUES ($1)', 'COMMIT']) {
  test(`database transaction rolls back and releases its client when ${failedStatement} rejects`, async () => {
    const failure = new Error('database write failed');
    const fixture = createTransactionFixture({ queryFailures: { [failedStatement]: failure } });
    let workCalls = 0;

    await assert.rejects(fixture.withTransaction(async (queryable) => {
      workCalls += 1;
      await queryable.query('INSERT INTO requests VALUES ($1)', ['request-1']);
      return { requestId: 'request-1' };
    }), (error) => error === failure);

    assert.equal(workCalls, failedStatement === 'BEGIN' ? 0 : 1);
    assert.equal(fixture.queries.at(-1).statement, 'ROLLBACK');
    assert.equal(fixture.queries.some(({ statement }) => statement === 'COMMIT'), failedStatement === 'COMMIT');
    assert.deepEqual(fixture.releases, [undefined]);
  });
}

test('database transaction rolls back a synchronous work failure', async () => {
  const fixture = createTransactionFixture();
  const failure = new Error('request construction failed');

  await assert.rejects(fixture.withTransaction(() => { throw failure; }), (error) => error === failure);

  assert.deepEqual(fixture.queries.map(({ statement }) => statement), ['BEGIN', 'ROLLBACK']);
  assert.deepEqual(fixture.releases, [undefined]);
});

test('database transaction preserves the original failure and evicts its client when rollback fails', async () => {
  const originalFailure = new Error('child creation failed');
  const rollbackFailure = new Error('connection lost during rollback');
  const fixture = createTransactionFixture({ queryFailures: { ROLLBACK: rollbackFailure } });

  await assert.rejects(fixture.withTransaction(async () => { throw originalFailure; }), (error) => error === originalFailure);

  assert.deepEqual(fixture.queries.map(({ statement }) => statement), ['BEGIN', 'ROLLBACK']);
  assert.deepEqual(fixture.releases, [rollbackFailure]);
});

test('database transaction does not run work when checking out a client fails', async () => {
  const failure = new Error('pool unavailable');
  let workCalls = 0;
  const withTransaction = createDatabaseTransactionRunner({
    getPoolFn: () => ({ connect: async () => { throw failure; } }),
  });

  await assert.rejects(withTransaction(async () => { workCalls += 1; }), (error) => error === failure);
  assert.equal(workCalls, 0);
});
