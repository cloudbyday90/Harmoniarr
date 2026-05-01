import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveDockerHubTagMaintenanceInputs } from '../../scripts/container-maintenance-inputs.js';

test('resolveDockerHubTagMaintenanceInputs prefers CLI values and repeated protected-tag flags', () => {
  const inputs = resolveDockerHubTagMaintenanceInputs({
    args: [
      '--dry-run',
      '--keep-count', '7',
      '--namespace', 'cli-namespace',
      '--protected-tag', 'latest',
      '--protected-tag', 'stable',
      '--repository', 'cli-repository',
      '--summary-path', 'cli-summary.md',
      '--token', 'cli-token',
      '--username', 'cli-user',
    ],
    env: {
      HARMONIARR_DOCKERHUB_DRY_RUN: 'false',
      HARMONIARR_DOCKERHUB_KEEP_TAGS: '3',
      HARMONIARR_DOCKERHUB_NAMESPACE: 'env-namespace',
      HARMONIARR_DOCKERHUB_PROTECTED_TAGS: 'env-tag',
      HARMONIARR_DOCKERHUB_REPOSITORY: 'env-repository',
      DOCKERHUB_TOKEN: 'env-token',
      DOCKERHUB_USERNAME: 'env-user',
      GITHUB_STEP_SUMMARY: 'env-summary.md',
    },
  });

  assert.equal(inputs.dryRun, true);
  assert.equal(inputs.keepCount, 7);
  assert.equal(inputs.namespace, 'cli-namespace');
  assert.deepEqual(inputs.protectedTags, ['latest', 'stable']);
  assert.equal(inputs.repository, 'cli-repository');
  assert.equal(inputs.summaryPath, 'cli-summary.md');
  assert.equal(inputs.token, 'cli-token');
  assert.equal(inputs.username, 'cli-user');
});

test('resolveDockerHubTagMaintenanceInputs falls back to env values and default protected tags', () => {
  const inputs = resolveDockerHubTagMaintenanceInputs({
    env: {
      HARMONIARR_DOCKERHUB_KEEP_TAGS: '5',
      HARMONIARR_DOCKERHUB_NAMESPACE: 'cloudbyday90',
      HARMONIARR_DOCKERHUB_REPOSITORY: 'harmoniarr',
      DOCKERHUB_TOKEN: 'dockerhub-token',
      DOCKERHUB_USERNAME: 'cloudbyday90',
    },
  });

  assert.equal(inputs.dryRun, false);
  assert.equal(inputs.keepCount, 5);
  assert.deepEqual(inputs.protectedTags, ['latest']);
});