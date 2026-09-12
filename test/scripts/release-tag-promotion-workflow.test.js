import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getWorkflowJobBlock, getWorkflowStepBlock } from '../../scripts/release-image-workflow-contract.js';

test('build and trusted mirror staging cannot publish the intended release aliases', async () => {
  const source = await readFile(new URL('../../.github/workflows/release-image.yml', import.meta.url), 'utf8');
  const buildJob = getWorkflowJobBlock(source, 'publish-image');
  const build = getWorkflowStepBlock(buildJob, 'Build and push multi-arch image');
  assert.match(build, /tags: \$\{\{ steps.candidate.outputs.candidate_tags \}\}/);
  assert.doesNotMatch(build, /steps.meta.outputs.tags|type=raw/);
  const plan = getWorkflowStepBlock(buildJob, 'Plan run-specific candidate tags');
  assert.match(plan, /run: node scripts\/write-release-candidate-tags.js/);
  assert.match(plan, /HARMONIARR_RELEASE_REVISION: \$\{\{ github.sha \}\}/);
  assert.doesNotMatch(plan, /\bif:|continue-on-error/);
  assert.ok(buildJob.indexOf('Plan run-specific candidate tags') < buildJob.indexOf('Build and push multi-arch image'));
  const contract = getWorkflowJobBlock(source, 'verify-release-contract');
  const env = getWorkflowStepBlock(contract, 'Probe Docker Hub trusted mirror capabilities');
  assert.match(env, /HARMONIARR_RELEASE_MIRROR_STAGING_TAG: \$\{\{ needs.publish-image.outputs.candidate_tag \}\}/);
  const copy = getWorkflowStepBlock(contract, 'Promote Docker Hub trusted mirror referrers');
  assert.match(copy, /env: \*trusted_dockerhub_release_env/);
  const verify = getWorkflowStepBlock(contract, 'Verify Docker Hub mirror references');
  assert.match(verify, /run: node scripts\/verify-staged-release-mirror.js/);
});

test('release alias promotion requires complete acceptance and immutable publication requires promotion success', async () => {
  const source = await readFile(new URL('../../.github/workflows/release-image.yml', import.meta.url), 'utf8');
  const promote = getWorkflowJobBlock(source, 'promote-release-tags');
  for (const dependency of ['publish-image', 'verify-release-contract']) {
    assert.match(promote, new RegExp(`^ {6}- ${dependency}$`, 'm'));
  }
  assert.doesNotMatch(promote, /^ {4}if:|continue-on-error:|contents: write|id-token:|attestations:/m);
  assert.match(promote, /packages: write/);
  assert.match(promote, /docker\/setup-buildx-action@4d04d5d9486b7bd6fa91e7baf45bbb4f8b9deedd/);
  const command = getWorkflowStepBlock(promote, 'Promote and verify accepted digest aliases');
  assert.match(command, /HARMONIARR_IMAGE: \$\{\{ needs.publish-image.outputs.image_ref \}\}/);
  assert.match(command, /run: node scripts\/promote-release-image-tags.js/);
  assert.doesNotMatch(command, /\bif:|continue-on-error/);
  const publication = getWorkflowJobBlock(source, 'publish-release');
  assert.match(publication, /^ {6}- promote-release-tags$/m);
  assert.doesNotMatch(publication, /^ {4}if:|continue-on-error:/m);
  const evidence = getWorkflowStepBlock(promote, 'Upload verified tag promotion evidence');
  assert.match(evidence, /if-no-files-found: error/);
  assert.match(evidence, /path: supply-chain\/release-tag-promotion.json/);
});
