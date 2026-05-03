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

export function validateReleaseImageWorkflowContract(source) {
  if (!isNonEmptyString(source)) {
    throw new Error('workflow source is required');
  }

  const issues = [];
  const normalizedSource = source.replace(/\r\n/g, '\n');

  if (!normalizedSource.includes('trusted_dockerhub_mirror_enabled: ${{ steps.release.outputs.trusted_dockerhub_mirror_enabled }}')) {
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

  if (!/name:\s+Verify Release Contract[\s\S]*needs:[\s\S]*- publish-image[\s\S]*- verify-published-image/.test(normalizedSource)) {
    issues.push('verify-release-contract job must depend on publish-image and verify-published-image');
  }

  return issues;
}

export function assertReleaseImageWorkflowContract(source) {
  const issues = validateReleaseImageWorkflowContract(source);
  if (issues.length > 0) {
    throw new Error(issues.join('\n'));
  }
}
