import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  renderDockerHubSkipSummaryLines,
  renderGhcrActiveSummaryLines,
  renderGhcrPreviewSummaryLines,
  writeContainerMaintenanceSummary,
} from '../../scripts/container-maintenance-summary.js';

test('renderGhcrPreviewSummaryLines formats the dry-run summary', () => {
  assert.deepEqual(renderGhcrPreviewSummaryLines({
    keepCount: '10',
    packageName: 'harmoniarr',
  }), [
    '## GHCR Maintenance',
    '',
    '- Dry run requested; untagged GHCR cleanup skipped.',
    '- Package: harmoniarr',
    '- Untagged versions to keep: 10',
    '',
  ]);
});

test('renderGhcrActiveSummaryLines formats the active cleanup summary', () => {
  assert.deepEqual(renderGhcrActiveSummaryLines({
    keepCount: '10',
    packageName: 'harmoniarr',
  }), [
    '## GHCR Maintenance',
    '',
    '- Package: harmoniarr',
    '- Untagged versions retained: 10',
    '- Cleanup mode: active',
    '',
  ]);
});

test('renderDockerHubSkipSummaryLines formats the skip summary', () => {
  assert.deepEqual(renderDockerHubSkipSummaryLines(), [
    '## Docker Hub Maintenance',
    '',
    '- Docker Hub credentials are not configured for this repository.',
    '- Cleanup skipped.',
    '',
  ]);
});

test('writeContainerMaintenanceSummary accepts CLI overrides for ghcr-active summaries', async () => {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'harmoniarr-container-summary-'));
  const summaryPath = join(tempDirectory, 'summary.md');

  try {
    await writeContainerMaintenanceSummary('ghcr-active', {
      args: [
        'ghcr-active',
        '--summary-path', summaryPath,
        '--keep-count', '10',
        '--package-name', 'harmoniarr',
      ],
      env: {},
    });

    const summary = await readFile(summaryPath, 'utf8');
    assert.match(summary, /## GHCR Maintenance/);
    assert.match(summary, /Untagged versions retained: 10/);
    assert.match(summary, /Cleanup mode: active/);
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
});