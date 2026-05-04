import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertReleaseImageWorkflowContract,
  getWorkflowStepBlock,
  releaseImageEvidenceStep,
  releaseImageUpgradeEvidenceStep,
  releaseImageUpgradeValidationStep,
  releaseImageUpgradeWorkflow,
  releaseImageSummarySteps,
  trustedMirrorWorkflowEnvAnchor,
  trustedMirrorWorkflowSteps,
} from '../../scripts/release-image-workflow-contract.js';

const workflowPath = new URL('../../.github/workflows/release-image.yml', import.meta.url);

test('release-image workflow preserves the trusted mirror script contract', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  assert.doesNotThrow(() => assertReleaseImageWorkflowContract(workflowSource));
});

test('release-image workflow reuses the shared trusted mirror env anchor for promotion and verification', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  const promoteBlock = getWorkflowStepBlock(workflowSource, trustedMirrorWorkflowSteps.promote.name);
  const verifyBlock = getWorkflowStepBlock(workflowSource, trustedMirrorWorkflowSteps.verify.name);

  assert.match(promoteBlock, new RegExp(`env: \\*${trustedMirrorWorkflowEnvAnchor}`));
  assert.match(verifyBlock, new RegExp(`env: \\*${trustedMirrorWorkflowEnvAnchor}`));
});

test('release-image workflow delegates summary steps to Node scripts', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  for (const step of Object.values(releaseImageSummarySteps)) {
    const block = getWorkflowStepBlock(workflowSource, step.name);
    assert.match(block, new RegExp(step.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('release-image workflow uploads the published-image smoke evidence artifact', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  const block = getWorkflowStepBlock(workflowSource, releaseImageEvidenceStep.name);

  assert.match(block, new RegExp(releaseImageEvidenceStep.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(block, new RegExp(releaseImageEvidenceStep.artifactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(block, new RegExp(releaseImageEvidenceStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('release-image workflow supports optional published-image upgrade validation evidence', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  assert.match(workflowSource, new RegExp(`${releaseImageUpgradeWorkflow.baselineInputName}:`));
  assert.match(workflowSource, new RegExp(`vars\\['${releaseImageUpgradeWorkflow.baselineVariableName}'\\]`));

  const validationBlock = getWorkflowStepBlock(workflowSource, releaseImageUpgradeValidationStep.name);
  const evidenceBlock = getWorkflowStepBlock(workflowSource, releaseImageUpgradeEvidenceStep.name);

  assert.match(validationBlock, new RegExp(releaseImageUpgradeValidationStep.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(validationBlock, /HARMONIARR_BASELINE_IMAGE:/);
  assert.match(validationBlock, /HARMONIARR_IMAGE: \$\{\{ needs\.publish-image\.outputs\.image_ref \}\}/);
  assert.match(evidenceBlock, new RegExp(releaseImageUpgradeEvidenceStep.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(evidenceBlock, new RegExp(releaseImageUpgradeEvidenceStep.artifactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(evidenceBlock, new RegExp(releaseImageUpgradeEvidenceStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});