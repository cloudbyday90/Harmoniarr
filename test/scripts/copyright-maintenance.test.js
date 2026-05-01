import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCopyrightHeader,
  checkCopyrightHeader,
  COPYRIGHT_YEAR,
  insertCopyrightHeader,
  listCopyrightManagedFiles,
  updateCopyrightHeader,
} from '../../scripts/copyright-maintenance.js';

function createFakeFs(files) {
  const store = new Map(Object.entries(files));

  return {
    get(filePath) {
      return store.get(filePath);
    },
    readFileSync(filePath, encoding) {
      assert.equal(encoding, 'utf8');
      return store.get(filePath);
    },
    writeFileSync(filePath, content, encoding) {
      assert.equal(encoding, 'utf8');
      store.set(filePath, content);
    },
  };
}

test('insertCopyrightHeader preserves a shebang at the first line', () => {
  const content = '#!/usr/bin/env node\nconsole.log("ok");\n';

  const result = insertCopyrightHeader(content, { filePath: 'scripts/example.js' });

  assert.match(result, /^#!\/usr\/bin\/env node\n\/\*/);
  assert.match(result, /console\.log\("ok"\);/);
});

test('insertCopyrightHeader uses html comments for vue and html sources', () => {
  const result = insertCopyrightHeader('<template><div /></template>\n', {
    filePath: 'src/client/App.vue',
  });

  assert.match(result, /^<!--/);
  assert.match(result, /Copyright \(C\)/);
  assert.match(result, /<template><div \/><\/template>/);
});

test('addCopyrightHeader writes a header only when one is missing', () => {
  const fsModule = createFakeFs({
    'scripts/example.js': 'console.log("ok");\n',
  });

  assert.equal(addCopyrightHeader('scripts/example.js', { fsModule }), true);
  assert.match(fsModule.get('scripts/example.js'), /Copyright \(C\)/);
  assert.equal(addCopyrightHeader('scripts/example.js', { fsModule }), false);
});

test('updateCopyrightHeader refreshes legacy owner metadata', () => {
  const fsModule = createFakeFs({
    'scripts/example.js': [
      '/*',
      ' * Harmoniarr - Soulseek-native music library management',
      ' * Copyright (C) 2026 cloudbyday90',
      ' */',
      '',
      'export const value = true;',
      '',
    ].join('\n'),
  });

  const result = updateCopyrightHeader('scripts/example.js', { fsModule });

  assert.equal(result, 'updated');
  assert.match(
    fsModule.get('scripts/example.js'),
    new RegExp(`Copyright \\(C\\) ${COPYRIGHT_YEAR} Harmoniarr Contributors`),
  );
});

test('checkCopyrightHeader validates the current owner and year', () => {
  const content = insertCopyrightHeader('export const value = true;\n', {
    filePath: 'scripts/example.js',
  });
  const fsModule = createFakeFs({
    'scripts/example.js': content,
    'scripts/missing.js': 'export const missing = true;\n',
  });

  assert.deepEqual(checkCopyrightHeader('scripts/example.js', { fsModule }), {
    valid: true,
  });
  assert.deepEqual(checkCopyrightHeader('scripts/missing.js', { fsModule }), {
    valid: false,
    reason: 'No copyright header found',
  });
});

test('listCopyrightManagedFiles targets the current src layout and client vue sources', () => {
  const calls = [];
  const files = listCopyrightManagedFiles({
    glob(pattern, options) {
      calls.push({ pattern, options });
      return [`match:${pattern}`];
    },
  });

  assert.deepEqual(files, [
    'match:src/server/**/*.{js,jsx,ts,tsx,sql}',
    'match:src/client/**/*.{js,jsx,ts,tsx,vue,css,html}',
    'match:scripts/**/*.js',
  ]);
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].options, {
    nodir: true,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'],
  });
});