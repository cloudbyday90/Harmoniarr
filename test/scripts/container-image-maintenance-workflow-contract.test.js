import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflowPath = new URL('../../.github/workflows/container-image-maintenance.yml', import.meta.url);

test('container-image-maintenance workflow delegates summary steps to Node scripts', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  assert.match(workflowSource, /run: node scripts\/container-maintenance-summary\.js ghcr-preview/);
  assert.match(workflowSource, /run: node scripts\/container-maintenance-summary\.js ghcr-active/);
  assert.match(workflowSource, /run: node scripts\/container-maintenance-summary\.js dockerhub-skip/);
});