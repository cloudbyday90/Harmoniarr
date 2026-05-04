/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  dockerDeploymentEvidenceDirEnvVar,
  renderDockerDeploymentPathValidationSuccessMessage,
  runDockerDeploymentPathValidation,
} from './docker-deployment-validation.js';
import { dockerDeploymentSummaryPathEnvVar } from './docker-deployment-manifest.js';
import { getOptionalStringInput, parseStrictScriptOptions } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

export const validateDockerDeploymentPathCliOptions = Object.freeze({
  'baseline-image-ref': { type: 'string' },
  'evidence-dir': { type: 'string' },
  'image-ref': { type: 'string' },
  'summary-path': { type: 'string' },
});

export function resolveDockerDeploymentPathValidationInputs({
  args = process.argv.slice(2),
  env = process.env,
} = {}) {
  const { values } = parseStrictScriptOptions(validateDockerDeploymentPathCliOptions, {
    allowPositionals: true,
    args,
  });

  return {
    baselineImageRef: getOptionalStringInput(values, 'baseline-image-ref', 'HARMONIARR_BASELINE_IMAGE', env),
    evidenceDir: getOptionalStringInput(values, 'evidence-dir', dockerDeploymentEvidenceDirEnvVar, env),
    imageRef: getOptionalStringInput(values, 'image-ref', 'HARMONIARR_IMAGE', env),
    summaryPath: getOptionalStringInput(values, 'summary-path', dockerDeploymentSummaryPathEnvVar, env),
  };
}

export async function validateDockerDeploymentPathFromEnvironment(env = process.env, {
  args = process.argv.slice(2),
} = {}) {
  const inputs = resolveDockerDeploymentPathValidationInputs({ args, env });
  return runDockerDeploymentPathValidation(inputs);
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-validate-docker-deployment-path',
  renderSuccessMessage: renderDockerDeploymentPathValidationSuccessMessage,
  run: () => validateDockerDeploymentPathFromEnvironment(),
});