import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  assertReleaseImageWorkflowContract,
  getWorkflowStepBlock,
  releaseImageBrowserSmokeEvidenceDownloadStep,
  releaseImageBrowserSmokeEvidenceReleaseContractVerificationStep,
  releaseImageBrowserSmokeEvidenceStep,
  releaseImageBrowserSmokeEvidenceVerificationStep,
  releaseImageBrowserSmokeRuntimeStep,
  releaseImageDeploymentSummaryArtifactStep,
  releaseImageDeploymentSummaryStep,
  releaseImageEvidenceDownloadStep,
  releaseImageEvidenceStep,
  releaseImageEvidenceReleaseContractVerificationStep,
  releaseImageEvidenceVerificationStep,
  releaseImageUpgradeEvidenceDownloadStep,
  releaseImageUpgradeEvidenceStep,
  releaseImageUpgradeEvidenceReleaseContractVerificationStep,
  releaseImageUpgradeEvidenceVerificationStep,
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

  const verificationBlock = getWorkflowStepBlock(workflowSource, releaseImageEvidenceVerificationStep.name);
  const block = getWorkflowStepBlock(workflowSource, releaseImageEvidenceStep.name);

  assert.match(verificationBlock, new RegExp(releaseImageEvidenceVerificationStep.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(verificationBlock, new RegExp(releaseImageEvidenceStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(block, new RegExp(releaseImageEvidenceStep.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(block, new RegExp(releaseImageEvidenceStep.artifactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(block, new RegExp(releaseImageEvidenceStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('release-image workflow runs browser smoke verification and uploads browser smoke evidence artifact', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  const runtimeBlock = getWorkflowStepBlock(workflowSource, releaseImageBrowserSmokeRuntimeStep.name);
  const verifyBlock = getWorkflowStepBlock(workflowSource, releaseImageBrowserSmokeEvidenceVerificationStep.name);
  const uploadBlock = getWorkflowStepBlock(workflowSource, releaseImageBrowserSmokeEvidenceStep.name);

  assert.match(runtimeBlock, new RegExp(releaseImageBrowserSmokeRuntimeStep.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(runtimeBlock, new RegExp(releaseImageBrowserSmokeRuntimeStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(verifyBlock, new RegExp(releaseImageBrowserSmokeEvidenceVerificationStep.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(verifyBlock, new RegExp(releaseImageBrowserSmokeEvidenceVerificationStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(uploadBlock, new RegExp(releaseImageBrowserSmokeEvidenceStep.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(uploadBlock, new RegExp(releaseImageBrowserSmokeEvidenceStep.artifactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(uploadBlock, new RegExp(releaseImageBrowserSmokeEvidenceStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('release-image workflow downloads and re-verifies archived published-image smoke evidence during release-contract verification', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  const downloadBlock = getWorkflowStepBlock(workflowSource, releaseImageEvidenceDownloadStep.name);
  const verificationBlock = getWorkflowStepBlock(workflowSource, releaseImageEvidenceReleaseContractVerificationStep.name);

  assert.match(downloadBlock, new RegExp(releaseImageEvidenceDownloadStep.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(downloadBlock, new RegExp(releaseImageEvidenceDownloadStep.artifactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(downloadBlock, new RegExp(releaseImageEvidenceDownloadStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(verificationBlock, new RegExp(releaseImageEvidenceReleaseContractVerificationStep.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(verificationBlock, new RegExp(releaseImageEvidenceReleaseContractVerificationStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('release-image workflow downloads and re-verifies archived published-image browser smoke evidence during release-contract verification', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  const downloadBlock = getWorkflowStepBlock(workflowSource, releaseImageBrowserSmokeEvidenceDownloadStep.name);
  const verificationBlock = getWorkflowStepBlock(workflowSource, releaseImageBrowserSmokeEvidenceReleaseContractVerificationStep.name);

  assert.match(downloadBlock, new RegExp(releaseImageBrowserSmokeEvidenceDownloadStep.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(downloadBlock, new RegExp(releaseImageBrowserSmokeEvidenceDownloadStep.artifactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(downloadBlock, new RegExp(releaseImageBrowserSmokeEvidenceDownloadStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(verificationBlock, new RegExp(releaseImageBrowserSmokeEvidenceReleaseContractVerificationStep.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(verificationBlock, new RegExp(releaseImageBrowserSmokeEvidenceReleaseContractVerificationStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('release-image workflow supports optional published-image upgrade validation evidence', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  assert.match(workflowSource, new RegExp(`${releaseImageUpgradeWorkflow.baselineInputName}:`));
  assert.match(workflowSource, new RegExp(`vars\\['${releaseImageUpgradeWorkflow.baselineVariableName}'\\]`));

  const validationBlock = getWorkflowStepBlock(workflowSource, releaseImageUpgradeValidationStep.name);
  const verificationBlock = getWorkflowStepBlock(workflowSource, releaseImageUpgradeEvidenceVerificationStep.name);
  const evidenceBlock = getWorkflowStepBlock(workflowSource, releaseImageUpgradeEvidenceStep.name);

  assert.match(validationBlock, new RegExp(releaseImageUpgradeValidationStep.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(validationBlock, /HARMONIARR_BASELINE_IMAGE:/);
  assert.match(validationBlock, /HARMONIARR_IMAGE: \$\{\{ needs\.publish-image\.outputs\.image_ref \}\}/);
  assert.match(verificationBlock, new RegExp(releaseImageUpgradeEvidenceVerificationStep.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(verificationBlock, new RegExp(releaseImageUpgradeEvidenceStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(evidenceBlock, new RegExp(releaseImageUpgradeEvidenceStep.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(evidenceBlock, new RegExp(releaseImageUpgradeEvidenceStep.artifactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(evidenceBlock, new RegExp(releaseImageUpgradeEvidenceStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('release-image workflow optionally downloads and re-verifies archived upgrade smoke evidence during release-contract verification', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  const downloadBlock = getWorkflowStepBlock(workflowSource, releaseImageUpgradeEvidenceDownloadStep.name);
  const verificationBlock = getWorkflowStepBlock(workflowSource, releaseImageUpgradeEvidenceReleaseContractVerificationStep.name);

  assert.match(downloadBlock, new RegExp(releaseImageUpgradeEvidenceDownloadStep.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(downloadBlock, new RegExp(releaseImageUpgradeEvidenceDownloadStep.artifactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(downloadBlock, new RegExp(releaseImageUpgradeEvidenceDownloadStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(downloadBlock, /if: \$\{\{ needs\.verify-upgrade-path\.result == 'success' \}\}/);
  assert.match(verificationBlock, new RegExp(releaseImageUpgradeEvidenceReleaseContractVerificationStep.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(verificationBlock, new RegExp(releaseImageUpgradeEvidenceReleaseContractVerificationStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(verificationBlock, /if: \$\{\{ needs\.verify-upgrade-path\.result == 'success' \}\}/);
});

test('release-image workflow writes and uploads a deployment summary artifact during release-contract verification', async () => {
  const workflowSource = await readFile(workflowPath, 'utf8');

  const writeBlock = getWorkflowStepBlock(workflowSource, releaseImageDeploymentSummaryStep.name);
  const uploadBlock = getWorkflowStepBlock(workflowSource, releaseImageDeploymentSummaryArtifactStep.name);

  assert.match(writeBlock, new RegExp(releaseImageDeploymentSummaryStep.command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(writeBlock, new RegExp(releaseImageDeploymentSummaryStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(writeBlock, /HARMONIARR_DOCKER_DEPLOYMENT_RELEASED_IMAGE_EVIDENCE_PATH: supply-chain\/harmoniarr-docker-smoke-released-image.json/);
  assert.match(uploadBlock, new RegExp(releaseImageDeploymentSummaryArtifactStep.action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(uploadBlock, new RegExp(releaseImageDeploymentSummaryArtifactStep.artifactName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(uploadBlock, new RegExp(releaseImageDeploymentSummaryArtifactStep.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});