/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { scanMigrationSql } from './migration-sql-lexer.js';

const begin = /^BEGIN(?: WORK| TRANSACTION)?$/u;
const commit = /^COMMIT(?: WORK| TRANSACTION)?$/u;
const forbidden = /^(?:BEGIN|START|COMMIT|END|ROLLBACK|ABORT|SAVEPOINT|RELEASE|PREPARE|EXECUTE|SET|RESET|DISCARD|COPY)\b/u;
const refuse = () => Object.assign(new Error('Migration SQL must leave transaction and session ownership to the executor.'),
  { code: 'migration_sql_transaction_invalid' });
const blank = sql => sql.replace(/[^\r\n]/gu, token => ' '.repeat(token.length));

/** Preserve raw SQL/checksums; remove only a recognized plain outer frame in memory. */
export function prepareMigrationTransactionSql(sql) {
  if (typeof sql !== 'string') throw refuse();
  const statements = scanMigrationSql(sql);
  let body = statements, frames = [];
  if (statements.length >= 2 && begin.test(statements[0].code)) {
    if (commit.test(statements[1].code)) {
      // One historical file has an empty leading frame before its actual DDL.
      frames = statements.slice(0, 2); body = statements.slice(2);
    } else if (commit.test(statements.at(-1).code)) {
      frames = [statements[0], statements.at(-1)]; body = statements.slice(1, -1);
    }
  }
  if (!body.length || body.some(statement => forbidden.test(statement.code))) throw refuse();
  let result = sql;
  for (const frame of frames.toReversed()) result = result.slice(0, frame.start)
    + blank(result.slice(frame.start, frame.end)) + result.slice(frame.end);
  return result;
}
