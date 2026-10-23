/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { assertDatabasePublicationScope, withDatabasePublicationScope } from '../../src/server/database-publication-scope.js';

test('publication queryables expire and cannot regain authority when their native client is reused', async () => {
  const queries = [];
  const client = { query: text => { queries.push(text); return text; } };
  let retained;
  await withDatabasePublicationScope({ queryable: client, kind: 'spectral_job', ownerId: 'first' }, async owned => {
    retained = owned;
    assert.equal(owned.query('first'), 'first');
    assert.throws(() => assertDatabasePublicationScope(owned, { kind: 'spectral_job', ownerId: 'second' }), /authority/);
    assert.throws(() => assertDatabasePublicationScope(client, { kind: 'spectral_job' }), /authority/);
  });
  assert.throws(() => retained.query('late'), /authority/);
  await withDatabasePublicationScope({ queryable: client, kind: 'spectral_job', ownerId: 'second' }, owned => {
    assert.notEqual(owned, retained);
    assert.throws(() => retained.query('reused'), /authority/);
    owned.query('second');
  });
  assert.deepEqual(queries, ['first', 'second']);
});

for (const reason of [new Error('original'), null]) {
  test(`publication authority retires after ${reason === null ? 'null' : 'Error'}`, async () => {
    let retained;
    await assert.rejects(withDatabasePublicationScope({ queryable: {}, kind: 'spectral_job', ownerId: 'first' }, owned => {
      retained = owned;
      throw reason;
    }), error => error === reason);
    assert.throws(() => assertDatabasePublicationScope(retained, { kind: 'spectral_job' }), /authority/);
  });
}
