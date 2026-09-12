import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getWorkflowJobBlock, getWorkflowStepBlock } from '../../scripts/release-image-workflow-contract.js';
import { defaultReleaseAssetNames } from '../../scripts/release-contract.js';

const workflowPath = new URL('../../.github/workflows/release-image.yml', import.meta.url);

test('release publication starts from manual dispatch and cannot modify a published-release event', async () => {
  const source = (await readFile(workflowPath, 'utf8')).replace(/\r\n/g, '\n');
  const trigger = source.slice(source.indexOf('on:'), source.indexOf('permissions:'));
  assert.match(trigger, /workflow_dispatch:/);
  assert.doesNotMatch(trigger, /^ {2}release:|types:.*published/m);
  assert.match(trigger, /group: release-image-\$\{\{ github.repository \}\}/);
  assert.match(trigger, /cancel-in-progress: false/);
  assert.doesNotMatch(source, /gh release (?:upload|edit|create)|--clobber|publish-sbom/);
});

test('draft policy and tag checks precede builds while publication follows the complete verification graph', async () => {
  const source = await readFile(workflowPath, 'utf8');
  const prepare = getWorkflowJobBlock(source, 'prepare-release');
  const build = getWorkflowJobBlock(source, 'publish-image');
  const contract = getWorkflowJobBlock(source, 'verify-release-contract');
  const publish = getWorkflowJobBlock(source, 'publish-release');
  assert.match(build, /needs: prepare-release/);
  assert.doesNotMatch(build, /contents: write/);
  assert.match(prepare, /contents: write/);
  assert.match(publish, /attestations: read/);
  assert.match(prepare, /run: node scripts\/release-draft-lifecycle.js --mode prepare/);
  assert.match(prepare, /release_id: \$\{\{ steps.draft.outputs.release_id \}\}/);
  for (const dependency of ['prepare-release', 'publish-image', 'verify-release-contract']) {
    assert.match(publish, new RegExp(`^ {6}- ${dependency}$`, 'm'));
  }
  for (const dependency of ['publish-image', 'verify-image-provenance', 'verify-published-image']) {
    assert.ok(contract.includes(`needs.${dependency}.result == 'success'`));
  }
  assert.ok(contract.includes("needs.verify-upgrade-path.result == 'success' || needs.verify-upgrade-path.result == 'skipped'"));
  assert.doesNotMatch(contract, /github.event_name == 'release'/);
  for (const job of [prepare, publish]) {
    assert.doesNotMatch(job, /^ {4}if:|continue-on-error:|packages: write|id-token: write/m);
    assert.match(job, /HARMONIARR_RELEASE_POLICY_TOKEN: \$\{\{ secrets.RELEASE_POLICY_READ_TOKEN \}\}/);
    assert.match(job, /HARMONIARR_RELEASE_REVISION: \$\{\{ github.sha \}\}/);
    assert.match(job, /HARMONIARR_RELEASE_TAG: \$\{\{ inputs.release_tag \}\}/);
  }
  const finalStep = getWorkflowStepBlock(publish, 'Attach verified assets and publish immutable release');
  assert.match(finalStep, /HARMONIARR_RELEASE_ID: \$\{\{ needs.prepare-release.outputs.release_id \}\}/);
  assert.match(finalStep, /HARMONIARR_IMAGE: \$\{\{ needs.publish-image.outputs.image_ref \}\}/);
  assert.match(finalStep, /run: node scripts\/release-draft-lifecycle.js --mode finalize/);
  assert.doesNotMatch(finalStep, /\bif:|continue-on-error/);
});

test('verification and publication consume the same four fixed build artifacts from the current run', async () => {
  const source = await readFile(workflowPath, 'utf8');
  for (const jobId of ['verify-release-contract', 'publish-release']) {
    const job = getWorkflowJobBlock(source, jobId);
    for (const asset of Object.values(defaultReleaseAssetNames)) {
      const download = getWorkflowStepBlock(job, `Download ${asset} build artifact`);
      assert.match(download, /uses: actions\/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c/);
      assert.ok(download.includes(`name: ${asset}`));
      assert.match(download, /path: supply-chain/);
      assert.doesNotMatch(download, /run-id:|repository:|pattern:|\bif:|continue-on-error/);
    }
  }
  const publish = getWorkflowJobBlock(source, 'publish-release');
  assert.ok(publish.lastIndexOf('uses: actions/download-artifact@') < publish.indexOf('run: node scripts/release-draft-lifecycle.js --mode finalize'));
  const upload = getWorkflowStepBlock(publish, 'Upload immutable publication evidence');
  assert.match(upload, /path: supply-chain\/release-publication.json/);
  assert.match(upload, /if-no-files-found: error/);
  assert.doesNotMatch(upload, /\bif:|continue-on-error/);
});
