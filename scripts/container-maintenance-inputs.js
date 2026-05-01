/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  getBooleanInput,
  getOptionalStringInput,
  getRequiredStringInput,
  getStringListInput,
  parseNonNegativeIntegerInput,
  parseStrictScriptOptions,
} from './script-input-resolution.js';

export const dockerHubTagMaintenanceCliOptions = Object.freeze({
  'dry-run': { type: 'boolean' },
  'keep-count': { type: 'string' },
  namespace: { type: 'string' },
  'protected-tag': { multiple: true, type: 'string' },
  repository: { type: 'string' },
  'summary-path': { type: 'string' },
  token: { type: 'string' },
  username: { type: 'string' },
});

export function parseContainerMaintenanceScriptOptions(options, { args = process.argv.slice(2) } = {}) {
  return parseStrictScriptOptions(options, { args });
}

export function resolveDockerHubTagMaintenanceInputs({
  args = process.argv.slice(2),
  env = process.env,
  values,
} = {}) {
  const resolvedValues = values ?? parseContainerMaintenanceScriptOptions(dockerHubTagMaintenanceCliOptions, { args }).values;

  return {
    dryRun: getBooleanInput(resolvedValues, 'dry-run', 'HARMONIARR_DOCKERHUB_DRY_RUN', env, false),
    keepCount: parseNonNegativeIntegerInput({
      defaultValue: '5',
      env,
      envName: 'HARMONIARR_DOCKERHUB_KEEP_TAGS',
      optionName: 'keep-count',
      values: resolvedValues,
    }),
    namespace: getRequiredStringInput(resolvedValues, 'namespace', 'HARMONIARR_DOCKERHUB_NAMESPACE', env),
    protectedTags: getStringListInput({
      defaultValue: ['latest'],
      env,
      envName: 'HARMONIARR_DOCKERHUB_PROTECTED_TAGS',
      optionName: 'protected-tag',
      values: resolvedValues,
    }),
    repository: getRequiredStringInput(resolvedValues, 'repository', 'HARMONIARR_DOCKERHUB_REPOSITORY', env),
    summaryPath: getOptionalStringInput(resolvedValues, 'summary-path', 'GITHUB_STEP_SUMMARY', env),
    token: getRequiredStringInput(resolvedValues, 'token', 'DOCKERHUB_TOKEN', env),
    username: getRequiredStringInput(resolvedValues, 'username', 'DOCKERHUB_USERNAME', env),
  };
}