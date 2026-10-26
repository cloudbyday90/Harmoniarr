/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const identifierPart = /[\p{L}\p{N}_$\u0080-\uffff]/u;
const dollarTag = /^\$(?:[a-z_\u0080-\uffff][a-z0-9_\u0080-\uffff]*)?\$/iu;
const malformed = () => Object.assign(new Error('Migration SQL has an unterminated lexical construct.'), { code: 'migration_sql_transaction_invalid' });

/** Slice commands without interpreting function bodies, identifiers, strings or comments. */
export function scanMigrationSql(sql) {
  const statements = [];
  let start = 0, code = '', i = 0;
  const push = end => {
    if (code.trim()) statements.push({ start, end, code: code.trim().replace(/\s+/gu, ' ').toUpperCase() });
    start = end; code = '';
  };
  while (i < sql.length) {
    if (sql.startsWith('--', i)) {
      while (i < sql.length && sql[i] !== '\r' && sql[i] !== '\n') i++;
      code += ' '; continue;
    }
    if (sql.startsWith('/*', i)) {
      let depth = 1; i += 2;
      while (i < sql.length && depth) {
        if (sql.startsWith('/*', i)) { depth++; i += 2; }
        else if (sql.startsWith('*/', i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) throw malformed();
      code += ' '; continue;
    }
    if (sql[i] === "'" || sql[i] === '"') {
      const quote = sql[i];
      const escaped = quote === "'" && /e/iu.test(sql[i - 1] ?? '') && !identifierPart.test(sql[i - 2] ?? '');
      i++; let closed = false;
      while (i < sql.length) {
        if (escaped && sql[i] === '\\') { i += 2; continue; }
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) { i += 2; continue; }
          i++; closed = true; break;
        }
        i++;
      }
      if (!closed) throw malformed();
      code += ' @quoted '; continue;
    }
    if (sql[i] === '$' && !identifierPart.test(sql[i - 1] ?? '')) {
      const tag = sql.slice(i).match(dollarTag)?.[0];
      if (tag) {
        const end = sql.indexOf(tag, i + tag.length);
        if (end < 0) throw malformed();
        i = end + tag.length; code += ' @body '; continue;
      }
    }
    if (sql[i] === ';') { push(i + 1); i++; continue; }
    code += sql[i++];
  }
  push(sql.length);
  return statements;
}
