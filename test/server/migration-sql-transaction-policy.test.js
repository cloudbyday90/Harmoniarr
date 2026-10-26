/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadMigrationManifest, checksumSql } from '../../src/server/migration-manifest.js';
import { prepareMigrationTransactionSql } from '../../src/server/migration-sql-transaction-policy.js';
import { scanMigrationSql } from '../../src/server/migration-sql-lexer.js';

test('all historical migration bytes retain their checksums and compile without top-level transaction controls', async () => {
  const rows = await loadMigrationManifest(); let changed = 0;
  for (const row of rows) {
    const body = prepareMigrationTransactionSql(row.sql);
    assert.equal(checksumSql(row.sql), row.checksum);
    assert.equal(body.split('\n').length, row.sql.split('\n').length);
    assert.equal(scanMigrationSql(body).some(statement => /^(BEGIN|COMMIT)\b/u.test(statement.code)), false);
    if (body !== row.sql) changed++;
  }
  assert.equal(rows.length, 115); assert.equal(changed, 42);
});

test('lexical slicing preserves nested comments, escaped/ordinary strings, identifiers and tagged procedural bodies', () => {
  const sql = String.raw`/* outer /* COMMIT; */ end */ BEGIN /* split */;
    CREATE FUNCTION "semi;""colon"() RETURNS void LANGUAGE plpgsql AS $function$
      BEGIN PERFORM ';COMMIT;'; END;
    $function$;
    SELECT E'quote\';COMMIT;still string', 'doubled '' ;BEGIN;', $other$;ROLLBACK;$other$;
    COMMIT; -- trailing`;
  const body = prepareMigrationTransactionSql(sql);
  assert.equal(scanMigrationSql(body).length, 2);
  assert.match(body, /BEGIN PERFORM ';COMMIT;'; END;/u);
  assert.equal(body.length, sql.length);
  assert.equal(prepareMigrationTransactionSql('SELECT foo$bar$ FROM "COMMIT";'), 'SELECT foo$bar$ FROM "COMMIT";');
});

test('empty historical prefix frames are ignored while meaningful split transactions are refused', () => {
  assert.match(prepareMigrationTransactionSql('BEGIN; /* empty */ COMMIT; ALTER TABLE t ADD c int;'), /ALTER TABLE t ADD c int;/u);
  for (const sql of ['BEGIN; SELECT 1; COMMIT; SELECT 2;', 'BEGIN; SELECT 1; COMMIT; BEGIN; SELECT 2; COMMIT;']) {
    assert.throws(() => prepareMigrationTransactionSql(sql), { code: 'migration_sql_transaction_invalid' });
  }
});

test('unpaired, nonplain, session-changing and internal transaction commands refuse before execution', () => {
  for (const sql of ['BEGIN;SELECT 1;', 'SELECT 1;COMMIT;', 'BEGIN READ ONLY;SELECT 1;COMMIT;', 'BEGIN;ROLLBACK;COMMIT;',
    'SELECT 1;END;', 'START TRANSACTION;SELECT 1;COMMIT;', 'SAVEPOINT a;', 'SET standard_conforming_strings=off;',
    'RESET ALL;', 'PREPARE TRANSACTION \'x\';', 'COMMIT AND CHAIN;', '/* only comments */', 'BEGIN;COMMIT;']) {
    assert.throws(() => prepareMigrationTransactionSql(sql), { code: 'migration_sql_transaction_invalid' }, sql);
  }
});

test('unterminated comments, quotes and dollar bodies fail closed', () => {
  for (const sql of ["SELECT 'unterminated", '/* nested /* x */', 'DO $tag$ BEGIN END;', 'SELECT "quoted', String.raw`SELECT E'escape\'`]) {
    assert.throws(() => prepareMigrationTransactionSql(sql), { code: 'migration_sql_transaction_invalid' });
  }
});
