import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  appendGitHubOutputEntries,
  formatGitHubOutputEntries,
} from '../../scripts/github-actions-output.js';
import { parseGitHubEnvironmentFile } from './github-actions-fixture.js';

test('formatGitHubOutputEntries renders simple and multiline values for GitHub output files', () => {
  const formatted = formatGitHubOutputEntries([
    { name: 'enabled', value: true },
    { name: 'count', value: 2 },
    { name: 'images', value: 'ghcr.io/example/app\ndocker.io/example/app' },
  ]);

  const parsed = parseGitHubEnvironmentFile(formatted);
  assert.deepEqual(parsed, {
    count: '2',
    enabled: 'true',
    images: 'ghcr.io/example/app\ndocker.io/example/app',
  });
});

test('appendGitHubOutputEntries writes UTF-8 output lines to the target file', async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-github-output-'));
  const outputPath = join(tempDirectory, 'github-output.txt');

  try {
    await appendGitHubOutputEntries(outputPath, [
      { name: 'name', value: 'dockerHub' },
      { name: 'fallback', value: false },
    ]);

    const output = await readFile(outputPath, 'utf8');
    assert.deepEqual(parseGitHubEnvironmentFile(output), {
      fallback: 'false',
      name: 'dockerHub',
    });
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
});