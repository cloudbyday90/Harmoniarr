import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { resolveReleaseBaseline } from '../../scripts/release-baseline-plan.js';
import { getWorkflowJobBlock, getWorkflowStepBlock } from '../../scripts/release-image-workflow-contract.js';

const image = `ghcr.io/cloudbyday90/harmoniarr@sha256:${'a'.repeat(64)}`;
const revision = 'b'.repeat(40);
const defaults = {
  HARMONIARR_REPOSITORY: 'cloudbyday90/Harmoniarr',
  HARMONIARR_DEFAULT_BASELINE_IMAGE: image,
  HARMONIARR_DEFAULT_BASELINE_REVISION: revision,
};

test('baseline selection uses complete pairs and supports an absent optional baseline', () => {
  assert.deepEqual(resolveReleaseBaseline({}), { enabled: false, image: '', revision: '' });
  assert.deepEqual(resolveReleaseBaseline(defaults), { enabled: true, image, revision });
  const selectedImage = `${image.split('@')[0]}@sha256:${'c'.repeat(64)}`;
  const selectedRevision = 'd'.repeat(40);
  assert.deepEqual(resolveReleaseBaseline({ ...defaults,
    HARMONIARR_INPUT_BASELINE_IMAGE: selectedImage,
    HARMONIARR_INPUT_BASELINE_REVISION: selectedRevision,
  }), { enabled: true, image: selectedImage, revision: selectedRevision });
});

test('baseline selection rejects partial overrides instead of filling them from defaults', () => {
  for (const override of [
    { HARMONIARR_INPUT_BASELINE_IMAGE: image },
    { HARMONIARR_INPUT_BASELINE_REVISION: revision },
    { HARMONIARR_DEFAULT_BASELINE_REVISION: '' },
    { HARMONIARR_DEFAULT_BASELINE_IMAGE: '' },
  ]) assert.throws(() => resolveReleaseBaseline({ ...defaults, ...override }));
});

test('baseline selection rejects mutable, foreign, abbreviated and output-injecting identities', () => {
  for (const invalidImage of ['harmoniarr:latest', image.replace('cloudbyday90', 'other'), `${image}\nbaseline_enabled=false`]) {
    assert.throws(() => resolveReleaseBaseline({ ...defaults, HARMONIARR_DEFAULT_BASELINE_IMAGE: invalidImage }));
  }
  for (const invalidRevision of ['abcdef', `${revision}\ninjected=true`]) {
    assert.throws(() => resolveReleaseBaseline({ ...defaults, HARMONIARR_DEFAULT_BASELINE_REVISION: invalidRevision }));
  }
});

test('all published image execution depends on an unconditional least-privilege provenance gate', async () => {
  const source = await readFile(new URL('../../.github/workflows/release-image.yml', import.meta.url), 'utf8');
  const gate = getWorkflowJobBlock(source, 'verify-image-provenance');
  assert.match(gate, /needs: publish-image/);
  assert.doesNotMatch(gate, /^ {4}if:|continue-on-error:|: write|docker (?:run|compose|pull)/m);
  for (const permission of ['contents', 'packages', 'attestations']) assert.match(gate, new RegExp(`${permission}: read`));
  const candidate = getWorkflowStepBlock(gate, 'Verify candidate provenance before runtime');
  assert.doesNotMatch(candidate, /\bif:|continue-on-error/);
  assert.match(candidate, /HARMONIARR_IMAGE_REVISION: \$\{\{ github.sha \}\}/);
  assert.match(candidate, /HARMONIARR_IMAGE: \$\{\{ needs.publish-image.outputs.image_ref \}\}/);
  assert.match(candidate, /run: node scripts\/verify-published-image-provenance.js/);
  const baseline = getWorkflowStepBlock(gate, 'Verify baseline provenance before runtime');
  assert.match(baseline, /if: \$\{\{ steps.baseline.outputs.baseline_enabled == 'true' \}\}/);
  assert.match(baseline, /HARMONIARR_IMAGE_REVISION: \$\{\{ steps.baseline.outputs.baseline_revision \}\}/);
  assert.match(baseline, /HARMONIARR_IMAGE: \$\{\{ steps.baseline.outputs.baseline_image \}\}/);
  assert.match(baseline, /run: node scripts\/verify-published-image-provenance.js/);
  assert.doesNotMatch(baseline, /continue-on-error/);
  for (const jobId of ['verify-published-image', 'verify-upgrade-path', 'verify-release-contract']) {
    const job = getWorkflowJobBlock(source, jobId);
    assert.match(job, /needs:\n(?: {6}- [\w-]+\n)* {6}- verify-image-provenance\n/);
    assert.doesNotMatch(job, /continue-on-error/);
  }
  const fresh = getWorkflowJobBlock(source, 'verify-published-image');
  assert.doesNotMatch(fresh, /^ {4}if:/m);
  assert.match(fresh, /uses: \.\/\.github\/actions\/setup-project-npm/);
  const dependenciesIndex = fresh.indexOf('run: npm ci');
  const browserInstallIndex = fresh.indexOf('run: npx playwright install chromium --with-deps');
  const browserRunIndex = fresh.indexOf('run: docker tag');
  assert.ok(dependenciesIndex > 0 && browserInstallIndex > dependenciesIndex && browserRunIndex > browserInstallIndex);

  const upgrade = getWorkflowJobBlock(source, 'verify-upgrade-path');
  assert.match(upgrade, /if: \$\{\{ needs.verify-image-provenance.outputs.baseline_enabled == 'true' \}\}/);
  assert.match(upgrade, /HARMONIARR_BASELINE_IMAGE: \$\{\{ needs.verify-image-provenance.outputs.baseline_image \}\}/);
  assert.doesNotMatch(upgrade, /inputs.baseline|vars\[/);
  const contract = getWorkflowJobBlock(source, 'verify-release-contract');
  assert.match(contract, /needs.verify-image-provenance.result == 'success'/);
  assert.doesNotMatch(source, /gh attestation verify|skipped for private repository/);
});
