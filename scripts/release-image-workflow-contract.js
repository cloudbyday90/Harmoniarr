/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export const trustedMirrorWorkflowEnvAnchor = 'trusted_dockerhub_release_env';

export const trustedMirrorWorkflowSteps = {
  probe: {
    command: 'npm run probe:release-mirror-capabilities',
    id: 'probe_trusted_mirror',
    name: 'Probe Docker Hub trusted mirror capabilities',
  },
  promote: {
    command: 'npm run promote:release-mirror-trust',
    name: 'Promote Docker Hub trusted mirror referrers',
  },
  verify: {
    command: 'npm run validate:release-mirror-referrers',
    name: 'Verify Docker Hub trusted mirror referrers',
  },
};

export const releaseImageSummarySteps = Object.freeze({
  publishImage: {
    command: 'node scripts/release-workflow-summary.js publish-image',
    name: 'Publish workflow summary',
  },
  verifyPublishedImage: {
    command: 'node scripts/release-workflow-summary.js verify-published-image',
    name: 'Publish verification summary',
  },
  verifyReleaseContract: {
    command: 'node scripts/release-workflow-summary.js verify-release-contract',
    name: 'Publish release-contract summary',
  },
});

export const releaseImageEvidenceStep = Object.freeze({
  action: 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
  artifactName: 'harmoniarr-docker-smoke-released-image.json',
  name: 'Upload published-image smoke evidence artifact',
  path: 'supply-chain/harmoniarr-docker-smoke-released-image.json',
});

export const releaseImageEvidenceVerificationStep = Object.freeze({
  command: 'npm run validate:docker-smoke-evidence',
  name: 'Verify published-image smoke evidence artifact',
});

export const releaseImageEvidenceDownloadStep = Object.freeze({
  action: 'actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0',
  artifactName: 'harmoniarr-docker-smoke-released-image.json',
  name: 'Download published-image smoke evidence artifact',
  path: 'supply-chain',
});

export const releaseImageEvidenceReleaseContractVerificationStep = Object.freeze({
  command: 'npm run validate:docker-smoke-evidence',
  name: 'Verify archived published-image smoke evidence artifact',
  path: 'supply-chain/harmoniarr-docker-smoke-released-image.json',
});

export const releaseImageUpgradeWorkflow = Object.freeze({
  baselineInputName: 'baseline_image',
  jobId: 'verify-upgrade-path',
  baselineVariableName: 'DOCKER_UPGRADE_BASELINE_IMAGE',
  jobName: 'Verify Upgrade Path',
});

export const releaseImageUpgradeValidationStep = Object.freeze({
  command: 'npm run validate:docker-upgrade',
  name: 'Validate published image upgrade path',
});

export const releaseImageUpgradeEvidenceStep = Object.freeze({
  action: 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
  artifactName: 'harmoniarr-docker-smoke-upgrade-path.json',
  name: 'Upload upgrade-path smoke evidence artifact',
  path: 'supply-chain/harmoniarr-docker-smoke-upgrade-path.json',
});

export const releaseImageUpgradeEvidenceVerificationStep = Object.freeze({
  command: 'npm run validate:docker-smoke-evidence',
  name: 'Verify upgrade-path smoke evidence artifact',
});

export const releaseImageUpgradeEvidenceDownloadStep = Object.freeze({
  action: 'actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0',
  artifactName: 'harmoniarr-docker-smoke-upgrade-path.json',
  name: 'Download upgrade-path smoke evidence artifact',
  path: 'supply-chain',
});

export const releaseImageUpgradeEvidenceReleaseContractVerificationStep = Object.freeze({
  command: 'npm run validate:docker-smoke-evidence',
  name: 'Verify archived upgrade-path smoke evidence artifact',
  path: 'supply-chain/harmoniarr-docker-smoke-upgrade-path.json',
});

export const releaseImageDeploymentSummaryStep = Object.freeze({
  command: 'npm run write:docker-deployment-summary',
  name: 'Write deployment summary artifact',
  path: 'supply-chain/harmoniarr-docker-deployment-summary.json',
});

export const releaseImageDeploymentSummaryArtifactStep = Object.freeze({
  action: 'actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',
  artifactName: 'harmoniarr-docker-deployment-summary.json',
  name: 'Upload deployment summary artifact',
  path: 'supply-chain/harmoniarr-docker-deployment-summary.json',
});

export const trustedMirrorWorkflowEnvKeys = [
  'DOCKERHUB_TOKEN',
  'DOCKERHUB_USERNAME',
  'GITHUB_TOKEN',
  'HARMONIARR_DOCKERHUB_NAMESPACE',
  'HARMONIARR_DOCKERHUB_REPOSITORY',
  'HARMONIARR_ENABLE_DOCKERHUB',
  'HARMONIARR_ENABLE_TRUSTED_DOCKERHUB_MIRROR',
  'HARMONIARR_RELEASE_EXPECTED_DIGEST',
  'HARMONIARR_RELEASE_METADATA_PATH',
  'HARMONIARR_RELEASE_MIRROR_KEY',
  'HARMONIARR_REPOSITORY_NAME',
  'HARMONIARR_REPOSITORY_OWNER',
];

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function getWorkflowStepBlock(source, stepName) {
  if (!isNonEmptyString(source)) {
    throw new Error('workflow source is required');
  }

  if (!isNonEmptyString(stepName)) {
    throw new Error('stepName is required');
  }

  const normalizedSource = source.replace(/\r\n/g, '\n');
  const lines = normalizedSource.split('\n');
  const header = `      - name: ${stepName.trim()}`;
  const startIndex = lines.findIndex((line) => line === header);

  if (startIndex === -1) {
    throw new Error(`Workflow step ${stepName} was not found`);
  }

  const collected = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (index > startIndex && /^ {6}- name: /.test(line)) {
      break;
    }

    collected.push(line);
  }

  return collected.join('\n');
}

export function getWorkflowJobBlock(source, jobId) {
  if (!isNonEmptyString(source)) {
    throw new Error('workflow source is required');
  }

  if (!isNonEmptyString(jobId)) {
    throw new Error('jobId is required');
  }

  const normalizedSource = source.replace(/\r\n/g, '\n');
  const lines = normalizedSource.split('\n');
  const header = `  ${jobId.trim()}:`;
  const startIndex = lines.findIndex((line) => line === header);

  if (startIndex === -1) {
    throw new Error(`Workflow job ${jobId} was not found`);
  }

  const collected = [];
  for (let index = startIndex; index < lines.length; index += 1) {
    const line = lines[index];
    if (index > startIndex && /^  [a-z0-9][a-z0-9-]*:$/i.test(line)) {
      break;
    }

    collected.push(line);
  }

  return collected.join('\n');
}

export function validateReleaseImageWorkflowContract(source) {
  if (!isNonEmptyString(source)) {
    throw new Error('workflow source is required');
  }

  const issues = [];
  const normalizedSource = source.replace(/\r\n/g, '\n');

  if (!normalizedSource.includes(`trusted_dockerhub_mirror_enabled: \${{ steps.release.outputs.trusted_dockerhub_mirror_enabled }}`)) {
    issues.push('publish-image job must expose trusted_dockerhub_mirror_enabled output');
  }

  if (!normalizedSource.includes(`env: &${trustedMirrorWorkflowEnvAnchor}`)) {
    issues.push(`trusted mirror steps must define the ${trustedMirrorWorkflowEnvAnchor} env anchor`);
  }

  for (const key of trustedMirrorWorkflowEnvKeys) {
    if (!normalizedSource.includes(`          ${key}: `)) {
      issues.push(`trusted mirror workflow env is missing ${key}`);
    }
  }

  for (const step of Object.values(trustedMirrorWorkflowSteps)) {
    let block;

    try {
      block = getWorkflowStepBlock(normalizedSource, step.name);
    } catch (error) {
      issues.push(error.message);
      continue;
    }

    if (step.id && !block.includes(`id: ${step.id}`)) {
      issues.push(`${step.name} must keep step id ${step.id}`);
    }

    if (!block.includes(`run: ${step.command}`)) {
      issues.push(`${step.name} must run ${step.command}`);
    }

    if (step.name !== trustedMirrorWorkflowSteps.probe.name && !block.includes(`env: *${trustedMirrorWorkflowEnvAnchor}`)) {
      issues.push(`${step.name} must reuse the ${trustedMirrorWorkflowEnvAnchor} env anchor`);
    }
  }

  if (!normalizedSource.includes("steps.probe_trusted_mirror.outputs.target_distribution_spec")) {
    issues.push('release summary must report the trusted mirror probe output');
  }

  for (const step of Object.values(releaseImageSummarySteps)) {
    let block;

    try {
      block = getWorkflowStepBlock(normalizedSource, step.name);
    } catch (error) {
      issues.push(error.message);
      continue;
    }

    if (!block.includes(`run: ${step.command}`)) {
      issues.push(`${step.name} must run ${step.command}`);
    }
  }

  try {
    const block = getWorkflowStepBlock(normalizedSource, releaseImageEvidenceVerificationStep.name);

    if (!block.includes(`run: ${releaseImageEvidenceVerificationStep.command}`)) {
      issues.push(`${releaseImageEvidenceVerificationStep.name} must run ${releaseImageEvidenceVerificationStep.command}`);
    }

    if (!block.includes(`HARMONIARR_DOCKER_SMOKE_EVIDENCE_PATH: ${releaseImageEvidenceStep.path}`)) {
      issues.push(`${releaseImageEvidenceVerificationStep.name} must verify ${releaseImageEvidenceStep.path}`);
    }
  } catch (error) {
    issues.push(error.message);
  }

  try {
    const block = getWorkflowStepBlock(normalizedSource, releaseImageEvidenceStep.name);

    if (!block.includes(`uses: ${releaseImageEvidenceStep.action}`)) {
      issues.push(`${releaseImageEvidenceStep.name} must use ${releaseImageEvidenceStep.action}`);
    }

    if (!block.includes(`name: ${releaseImageEvidenceStep.artifactName}`)) {
      issues.push(`${releaseImageEvidenceStep.name} must publish ${releaseImageEvidenceStep.artifactName}`);
    }

    if (!block.includes(`path: ${releaseImageEvidenceStep.path}`)) {
      issues.push(`${releaseImageEvidenceStep.name} must upload ${releaseImageEvidenceStep.path}`);
    }
  } catch (error) {
    issues.push(error.message);
  }

  if (!normalizedSource.includes("HARMONIARR_SUMMARY_SMOKE_EVIDENCE_ARTIFACT_NAME: harmoniarr-docker-smoke-released-image.json")) {
    issues.push('verify-published-image summary must report the smoke evidence artifact name');
  }

  if (!normalizedSource.includes('HARMONIARR_SUMMARY_SMOKE_CONTRACT_STATUS: passed')) {
    issues.push('verify-published-image summary must report the smoke evidence contract status');
  }

  try {
    const block = getWorkflowStepBlock(normalizedSource, releaseImageEvidenceDownloadStep.name);

    if (!block.includes(`uses: ${releaseImageEvidenceDownloadStep.action}`)) {
      issues.push(`${releaseImageEvidenceDownloadStep.name} must use ${releaseImageEvidenceDownloadStep.action}`);
    }

    if (!block.includes(`name: ${releaseImageEvidenceDownloadStep.artifactName}`)) {
      issues.push(`${releaseImageEvidenceDownloadStep.name} must download ${releaseImageEvidenceDownloadStep.artifactName}`);
    }

    if (!block.includes(`path: ${releaseImageEvidenceDownloadStep.path}`)) {
      issues.push(`${releaseImageEvidenceDownloadStep.name} must extract to ${releaseImageEvidenceDownloadStep.path}`);
    }
  } catch (error) {
    issues.push(error.message);
  }

  try {
    const block = getWorkflowStepBlock(normalizedSource, releaseImageEvidenceReleaseContractVerificationStep.name);

    if (!block.includes(`run: ${releaseImageEvidenceReleaseContractVerificationStep.command}`)) {
      issues.push(`${releaseImageEvidenceReleaseContractVerificationStep.name} must run ${releaseImageEvidenceReleaseContractVerificationStep.command}`);
    }

    if (!block.includes(`HARMONIARR_DOCKER_SMOKE_EVIDENCE_PATH: ${releaseImageEvidenceReleaseContractVerificationStep.path}`)) {
      issues.push(`${releaseImageEvidenceReleaseContractVerificationStep.name} must verify ${releaseImageEvidenceReleaseContractVerificationStep.path}`);
    }
  } catch (error) {
    issues.push(error.message);
  }

  if (!normalizedSource.includes('HARMONIARR_SUMMARY_SMOKE_EVIDENCE_STATUS: published-image artifact passed')) {
    issues.push('verify-release-contract summary must report archived smoke evidence verification status');
  }

  if (!normalizedSource.includes('needs.verify-upgrade-path.result')) {
    issues.push('verify-release-contract job must consider needs.verify-upgrade-path.result when upgrade validation is optional');
  }

  if (!normalizedSource.includes(`${releaseImageUpgradeWorkflow.baselineInputName}:`)) {
    issues.push(`workflow_dispatch inputs must expose ${releaseImageUpgradeWorkflow.baselineInputName}`);
  }

  if (!normalizedSource.includes(`vars['${releaseImageUpgradeWorkflow.baselineVariableName}']`)) {
    issues.push(`verify-upgrade-path job must read ${releaseImageUpgradeWorkflow.baselineVariableName}`);
  }

  try {
    const block = getWorkflowJobBlock(normalizedSource, releaseImageUpgradeWorkflow.jobId);

    if (!block.includes(`name: ${releaseImageUpgradeWorkflow.jobName}`)) {
      issues.push(`workflow job ${releaseImageUpgradeWorkflow.jobId} must be named ${releaseImageUpgradeWorkflow.jobName}`);
    }

    if (!block.includes('needs:') || !block.includes('- publish-image') || !block.includes('- verify-published-image')) {
      issues.push('verify-upgrade-path job must depend on publish-image and verify-published-image');
    }
  } catch (error) {
    issues.push(error.message);
  }

  try {
    const block = getWorkflowJobBlock(normalizedSource, 'verify-release-contract');

    if (!block.includes('- verify-upgrade-path')) {
      issues.push('verify-release-contract job must depend on verify-upgrade-path');
    }

    if (!block.includes("always()") || !block.includes("needs.verify-upgrade-path.result == 'success'") || !block.includes("needs.verify-upgrade-path.result == 'skipped'")) {
      issues.push('verify-release-contract job must use always() and allow verify-upgrade-path to be either success or skipped');
    }
  } catch (error) {
    issues.push(error.message);
  }

  try {
    const block = getWorkflowStepBlock(normalizedSource, releaseImageUpgradeValidationStep.name);

    if (!block.includes(`run: ${releaseImageUpgradeValidationStep.command}`)) {
      issues.push(`${releaseImageUpgradeValidationStep.name} must run ${releaseImageUpgradeValidationStep.command}`);
    }

    if (!block.includes(`HARMONIARR_BASELINE_IMAGE: \${{ github.event_name == 'workflow_dispatch' && inputs.${releaseImageUpgradeWorkflow.baselineInputName} || vars['${releaseImageUpgradeWorkflow.baselineVariableName}'] }}`.replace('\\', ''))) {
      issues.push(`${releaseImageUpgradeValidationStep.name} must source HARMONIARR_BASELINE_IMAGE from workflow input or repository variable`);
    }

    if (!block.includes("HARMONIARR_IMAGE: ${{ needs.publish-image.outputs.image_ref }}")) {
      issues.push(`${releaseImageUpgradeValidationStep.name} must validate the published immutable image`);
    }
  } catch (error) {
    issues.push(error.message);
  }

  try {
    const block = getWorkflowStepBlock(normalizedSource, releaseImageUpgradeEvidenceVerificationStep.name);

    if (!block.includes(`run: ${releaseImageUpgradeEvidenceVerificationStep.command}`)) {
      issues.push(`${releaseImageUpgradeEvidenceVerificationStep.name} must run ${releaseImageUpgradeEvidenceVerificationStep.command}`);
    }

    if (!block.includes(`HARMONIARR_DOCKER_SMOKE_EVIDENCE_PATH: ${releaseImageUpgradeEvidenceStep.path}`)) {
      issues.push(`${releaseImageUpgradeEvidenceVerificationStep.name} must verify ${releaseImageUpgradeEvidenceStep.path}`);
    }
  } catch (error) {
    issues.push(error.message);
  }

  try {
    const block = getWorkflowStepBlock(normalizedSource, releaseImageUpgradeEvidenceStep.name);

    if (!block.includes(`uses: ${releaseImageUpgradeEvidenceStep.action}`)) {
      issues.push(`${releaseImageUpgradeEvidenceStep.name} must use ${releaseImageUpgradeEvidenceStep.action}`);
    }

    if (!block.includes(`name: ${releaseImageUpgradeEvidenceStep.artifactName}`)) {
      issues.push(`${releaseImageUpgradeEvidenceStep.name} must publish ${releaseImageUpgradeEvidenceStep.artifactName}`);
    }

    if (!block.includes(`path: ${releaseImageUpgradeEvidenceStep.path}`)) {
      issues.push(`${releaseImageUpgradeEvidenceStep.name} must upload ${releaseImageUpgradeEvidenceStep.path}`);
    }
  } catch (error) {
    issues.push(error.message);
  }

  try {
    const block = getWorkflowStepBlock(normalizedSource, releaseImageUpgradeEvidenceDownloadStep.name);

    if (!block.includes(`uses: ${releaseImageUpgradeEvidenceDownloadStep.action}`)) {
      issues.push(`${releaseImageUpgradeEvidenceDownloadStep.name} must use ${releaseImageUpgradeEvidenceDownloadStep.action}`);
    }

    if (!block.includes(`name: ${releaseImageUpgradeEvidenceDownloadStep.artifactName}`)) {
      issues.push(`${releaseImageUpgradeEvidenceDownloadStep.name} must download ${releaseImageUpgradeEvidenceDownloadStep.artifactName}`);
    }

    if (!block.includes(`path: ${releaseImageUpgradeEvidenceDownloadStep.path}`)) {
      issues.push(`${releaseImageUpgradeEvidenceDownloadStep.name} must extract to ${releaseImageUpgradeEvidenceDownloadStep.path}`);
    }

    if (!block.includes("if: ${{ needs.verify-upgrade-path.result == 'success' }}")) {
      issues.push(`${releaseImageUpgradeEvidenceDownloadStep.name} must only run when verify-upgrade-path succeeded`);
    }
  } catch (error) {
    issues.push(error.message);
  }

  try {
    const block = getWorkflowStepBlock(normalizedSource, releaseImageUpgradeEvidenceReleaseContractVerificationStep.name);

    if (!block.includes(`run: ${releaseImageUpgradeEvidenceReleaseContractVerificationStep.command}`)) {
      issues.push(`${releaseImageUpgradeEvidenceReleaseContractVerificationStep.name} must run ${releaseImageUpgradeEvidenceReleaseContractVerificationStep.command}`);
    }

    if (!block.includes(`HARMONIARR_DOCKER_SMOKE_EVIDENCE_PATH: ${releaseImageUpgradeEvidenceReleaseContractVerificationStep.path}`)) {
      issues.push(`${releaseImageUpgradeEvidenceReleaseContractVerificationStep.name} must verify ${releaseImageUpgradeEvidenceReleaseContractVerificationStep.path}`);
    }

    if (!block.includes("if: ${{ needs.verify-upgrade-path.result == 'success' }}")) {
      issues.push(`${releaseImageUpgradeEvidenceReleaseContractVerificationStep.name} must only run when verify-upgrade-path succeeded`);
    }
  } catch (error) {
    issues.push(error.message);
  }

  if (!normalizedSource.includes('HARMONIARR_SUMMARY_UPGRADE_SMOKE_EVIDENCE_STATUS: ${{ needs.verify-upgrade-path.result == \'success\' && \'upgrade-path artifact passed\' || \'skipped\' }}')) {
    issues.push('verify-release-contract summary must report archived upgrade smoke evidence verification status');
  }

  try {
    const block = getWorkflowStepBlock(normalizedSource, releaseImageDeploymentSummaryStep.name);

    if (!block.includes(`run: ${releaseImageDeploymentSummaryStep.command}`)) {
      issues.push(`${releaseImageDeploymentSummaryStep.name} must run ${releaseImageDeploymentSummaryStep.command}`);
    }

    if (!block.includes(`HARMONIARR_DOCKER_DEPLOYMENT_SUMMARY_PATH: ${releaseImageDeploymentSummaryStep.path}`)) {
      issues.push(`${releaseImageDeploymentSummaryStep.name} must write ${releaseImageDeploymentSummaryStep.path}`);
    }

    if (!block.includes('HARMONIARR_DOCKER_DEPLOYMENT_RELEASED_IMAGE_EVIDENCE_PATH: supply-chain/harmoniarr-docker-smoke-released-image.json')) {
      issues.push(`${releaseImageDeploymentSummaryStep.name} must source the archived published-image smoke evidence artifact`);
    }
  } catch (error) {
    issues.push(error.message);
  }

  try {
    const block = getWorkflowStepBlock(normalizedSource, releaseImageDeploymentSummaryArtifactStep.name);

    if (!block.includes(`uses: ${releaseImageDeploymentSummaryArtifactStep.action}`)) {
      issues.push(`${releaseImageDeploymentSummaryArtifactStep.name} must use ${releaseImageDeploymentSummaryArtifactStep.action}`);
    }

    if (!block.includes(`name: ${releaseImageDeploymentSummaryArtifactStep.artifactName}`)) {
      issues.push(`${releaseImageDeploymentSummaryArtifactStep.name} must publish ${releaseImageDeploymentSummaryArtifactStep.artifactName}`);
    }

    if (!block.includes(`path: ${releaseImageDeploymentSummaryArtifactStep.path}`)) {
      issues.push(`${releaseImageDeploymentSummaryArtifactStep.name} must upload ${releaseImageDeploymentSummaryArtifactStep.path}`);
    }
  } catch (error) {
    issues.push(error.message);
  }

  if (!normalizedSource.includes('HARMONIARR_SUMMARY_DEPLOYMENT_SUMMARY_ARTIFACT_NAME: harmoniarr-docker-deployment-summary.json')) {
    issues.push('verify-release-contract summary must report the deployment summary artifact name');
  }

  if (!/name:\s+Verify Release Contract[\s\S]*needs:[\s\S]*- publish-image[\s\S]*- verify-published-image[\s\S]*- verify-upgrade-path/.test(normalizedSource)) {
    issues.push('verify-release-contract job must depend on publish-image, verify-published-image, and verify-upgrade-path');
  }

  return issues;
}

export function assertReleaseImageWorkflowContract(source) {
  const issues = validateReleaseImageWorkflowContract(source);
  if (issues.length > 0) {
    throw new Error(issues.join('\n'));
  }
}
