import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  extractScannableSections,
  findEsmViolations,
  listEsmConsistencyFiles,
} from '../../scripts/esm-consistency.js';

test('extractScannableSections returns raw source for non-vue files', () => {
  const sections = extractScannableSections('src/client/main.js', 'import { createApp } from "vue";\n');

  assert.deepEqual(sections, [{
    lineOffset: 0,
    source: 'import { createApp } from "vue";\n',
  }]);
});

test('extractScannableSections finds both normal and setup script blocks in vue files', () => {
  const source = [
    '<template>',
    '  <div />',
    '</template>',
    '',
    '<script>',
    'export default { name: "ExamplePanel" };',
    '</script>',
    '',
    '<script setup>',
    'import { ref } from "vue";',
    '</script>',
  ].join('\n');

  const sections = extractScannableSections('src/client/components/ExamplePanel.vue', source);

  assert.equal(sections.length, 2);
  assert.equal(sections[0].lineOffset, 4);
  assert.match(sections[0].source, /export default/);
  assert.equal(sections[1].lineOffset, 8);
  assert.match(sections[1].source, /import \{ ref \}/);
});

test('findEsmViolations ignores template content and reports vue script line numbers', () => {
  const source = [
    '<template>',
    '  <pre>require(\'not real code\')</pre>',
    '</template>',
    '',
    '<script setup>',
    'import { ref } from "vue";',
    'const state = ref(null);',
    'const legacy = require("./legacy.cjs");',
    '</script>',
  ].join('\n');

  const violations = findEsmViolations('src/client/components/ExamplePanel.vue', source);

  assert.deepEqual(violations, [{
    label: 'CommonJS require call',
    line: 8,
    relativePath: 'src/client/components/ExamplePanel.vue',
  }]);
});

test('listEsmConsistencyFiles includes vue sources in the managed scan', () => {
  const calls = [];
  const files = listEsmConsistencyFiles({
    cwd: 'workspace-root',
    glob(pattern, options) {
      calls.push({ pattern, options });
      return [`match:${pattern}`];
    },
  });

  assert.deepEqual(files, [
    'match:scripts/**/*.js',
    'match:src/**/*.js',
    'match:src/**/*.vue',
    'match:vite.config.js',
  ]);
  assert.deepEqual(calls, [
    { pattern: 'src/**/*.js', options: { cwd: 'workspace-root', nodir: true } },
    { pattern: 'src/**/*.vue', options: { cwd: 'workspace-root', nodir: true } },
    { pattern: 'scripts/**/*.js', options: { cwd: 'workspace-root', nodir: true } },
    { pattern: 'vite.config.js', options: { cwd: 'workspace-root', nodir: true } },
  ]);
});

test('esm-consistency helper does not flag its own detection implementation', async () => {
  const helperPath = fileURLToPath(new URL('../../scripts/esm-consistency.js', import.meta.url));
  const source = await readFile(helperPath, 'utf8');

  assert.deepEqual(findEsmViolations('scripts/esm-consistency.js', source), []);
});