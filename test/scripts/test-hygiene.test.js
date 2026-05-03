import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import {
  checkTestHygiene,
  findTestHygieneViolations,
  formatTestHygieneViolations,
  listTestHygieneFiles,
} from '../../scripts/test-hygiene.js';

suite('test-hygiene', () => {
  test('listTestHygieneFiles returns sorted managed test sources', () => {
    const files = listTestHygieneFiles({
      cwd: 'workspace-root',
      glob(pattern, options) {
        assert.equal(pattern, 'test/**/*.js');
        assert.deepEqual(options, { cwd: 'workspace-root', nodir: true });
        return ['test/z-last.test.js', 'test/a-first.test.js'];
      },
    });

    assert.deepEqual(files, ['test/a-first.test.js', 'test/z-last.test.js']);
  });

  test('findTestHygieneViolations catches focused, skipped, and todo test shorthands', () => {
    const source = [
      'test' + '.only' + '("focused", () => {});',
      'suite' + '.skip' + '("skipped", () => {});',
      'it' + '.todo' + '("todo");',
    ].join('\n');

    assert.deepEqual(findTestHygieneViolations('test/example.test.js', source), [
      {
        kind: 'focused_test',
        line: 1,
        message: 'Found focused test shorthand that would narrow coverage in CI.',
        relativePath: 'test/example.test.js',
      },
      {
        kind: 'skipped_test',
        line: 2,
        message: 'Found skipped test shorthand that would silently bypass coverage.',
        relativePath: 'test/example.test.js',
      },
      {
        kind: 'todo_test',
        line: 3,
        message: 'Found TODO test shorthand that leaves an incomplete test contract in the suite.',
        relativePath: 'test/example.test.js',
      },
    ]);
  });

  test('findTestHygieneViolations catches explicit only, skip, and todo options', () => {
    const source = [
      'test("focused", { ' + 'only' + ': true }, () => {});',
      'test("skipped", { ' + 'skip' + ': true }, () => {});',
      'test("todo", { ' + 'todo' + ': true }, () => {});',
    ].join('\n');

    assert.deepEqual(findTestHygieneViolations('test/options.test.js', source), [
      {
        kind: 'focused_test_option',
        line: 1,
        message: 'Found explicit `{ ' + 'only' + ': true }` test option.',
        relativePath: 'test/options.test.js',
      },
      {
        kind: 'skipped_test_option',
        line: 2,
        message: 'Found explicit `{ ' + 'skip' + ': true }` test option.',
        relativePath: 'test/options.test.js',
      },
      {
        kind: 'todo_test_option',
        line: 3,
        message: 'Found explicit `{ ' + 'todo' + ': true }` test option.',
        relativePath: 'test/options.test.js',
      },
    ]);
  });

  test('formatTestHygieneViolations renders actionable output', () => {
    const message = formatTestHygieneViolations([
      {
        kind: 'focused_test',
        line: 8,
        message: 'Found focused test shorthand that would narrow coverage in CI.',
        relativePath: 'test/example.test.js',
      },
    ]);

    assert.equal(
      message,
      [
        'Found test hygiene violations:',
        '  - test/example.test.js:8 focused_test: Found focused test shorthand that would narrow coverage in CI.',
      ].join('\n'),
    );
  });

  test('checkTestHygiene reports checked file count when clean', async () => {
    const result = await checkTestHygiene({
      cwd: 'workspace-root',
      glob() {
        return ['test/a.test.js'];
      },
      async readFileFn() {
        return 'test("clean", () => {});';
      },
    });

    assert.deepEqual(result, { checkedFiles: 1 });
  });

  test('checkTestHygiene throws with aggregated violations', async () => {
    await assert.rejects(
      () => checkTestHygiene({
        cwd: 'workspace-root',
        glob() {
          return ['test/a.test.js'];
        },
        async readFileFn() {
          return 'test' + '.only' + '("focused", () => {});';
        },
      }),
      /focused_test/,
    );
  });
});
