/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { writeDockerDeploymentSummary } from './docker-deployment-summary.js';
import { getOptionalStringInput, getRequiredStringInput, parseStrictScriptOptions } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

export const writeDockerDeploymentSummaryCliOptions = Object.freeze({
  'image-ref': { type: 'string' },
  'release-tag': { type: 'string' },
  'released-image-evidence-path': { type: 'string' },
  'summary-path': { type: 'string' },
  'upgrade-path-evidence-path': { type: 'string' },
});

export function resolveDockerDeploymentSummaryInputs({
  args = process.argv.slice(2),
  env = process.env,
} = {}) {
  const { values } = parseStrictScriptOptions(writeDockerDeploymentSummaryCliOptions, {
    allowPositionals: true,
    args,
  });

  return {
    imageRef: getOptionalStringInput(values, 'image-ref', 'HARMONIARR_DOCKER_DEPLOYMENT_IMAGE_REF', env),
    releaseTag: getOptionalStringInput(values, 'release-tag', 'HARMONIARR_DOCKER_DEPLOYMENT_RELEASE_TAG', env),
    releasedImageEvidencePath: getRequiredStringInput(values, 'released-image-evidence-path', 'HARMONIARR_DOCKER_DEPLOYMENT_RELEASED_IMAGE_EVIDENCE_PATH', env),
    summaryPath: getRequiredStringInput(values, 'summary-path', 'HARMONIARR_DOCKER_DEPLOYMENT_SUMMARY_PATH', env),
    upgradePathEvidencePath: getOptionalStringInput(values, 'upgrade-path-evidence-path', 'HARMONIARR_DOCKER_DEPLOYMENT_UPGRADE_EVIDENCE_PATH', env),
  };
}

export async function writeDockerDeploymentSummaryFromEnvironment(env = process.env, {
  args = process.argv.slice(2),
  mkdirFn,
  readFileFn,
  verifyDockerSmokeEvidenceFileFn,
  writeFileFn,
} = {}) {
  const inputs = resolveDockerDeploymentSummaryInputs({ args, env });

  return writeDockerDeploymentSummary({
    ...inputs,
    mkdirFn,
    readFileFn,
    verifyDockerSmokeEvidenceFileFn,
    writeFileFn,
  });
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-write-docker-deployment-summary',
  renderSuccessMessage: ({ summaryPath }) => `Docker deployment summary written to ${summaryPath}`,
  run: () => writeDockerDeploymentSummaryFromEnvironment(),
});