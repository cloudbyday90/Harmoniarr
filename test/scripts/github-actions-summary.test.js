import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  appendGitHubStepSummary,
  createMarkdownBulletList,
  formatGitHubStepSummary,
} from '../../scripts/github-actions-summary.js';

test('createMarkdownBulletList renders bullet items and a default empty entry', () => {
  assert.equal(createMarkdownBulletList(['alpha', 'beta']), '- alpha\n- beta');
  assert.equal(createMarkdownBulletList([]), '- none');
});

test('formatGitHubStepSummary joins lines with a trailing newline', () => {
  assert.equal(
    formatGitHubStepSummary(['## Example', '', '- Item: value']),
    '## Example\n\n- Item: value\n',
  );
});

test('appendGitHubStepSummary writes UTF-8 Markdown content', async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-github-summary-'));
  const summaryPath = join(tempDirectory, 'github-summary.md');

  try {
    await appendGitHubStepSummary(summaryPath, ['## Example', '', '- Item: value']);

    const summary = await readFile(summaryPath, 'utf8');
    assert.equal(summary, '## Example\n\n- Item: value\n');
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
});