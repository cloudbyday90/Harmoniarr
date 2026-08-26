/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  defaultDockerProviderAcceptanceBaseUrl,
  renderDockerProviderAcceptanceSuccessMessage,
  runDockerProviderAcceptanceEvidence,
} from './docker-provider-acceptance-evidence.js';
import { getOptionalDockerSmokeEvidencePath } from './docker-smoke-evidence.js';
import { getBooleanInput, getOptionalStringInput, getRequiredStringInput, parseStrictScriptOptions } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';
import { getRequiredSecretInput } from './secret-input.js';

export const dockerProviderAcceptanceEvidencePathEnvVar = 'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_EVIDENCE_PATH';
export const dockerProviderAcceptancePasswordFileEnvVar = 'HARMONIARR_WALKTHROUGH_PASSWORD_FILE';

export const validateDockerProviderAcceptanceCliOptions = Object.freeze({
  'base-url': { type: 'string' },
  'evidence-path': { type: 'string' },
  headless: { type: 'boolean' },
  password: { type: 'string' },
  'password-file': { type: 'string' },
  'require-accepted-transfer': { type: 'boolean' },
  'require-configured-provider': { type: 'boolean' },
  'require-diagnostic': { type: 'boolean' },
  'require-music-queue-link': { type: 'boolean' },
  'require-path-mapping': { type: 'boolean' },
  'screenshot-dir': { type: 'string' },
  'timeout-ms': { type: 'string' },
  username: { type: 'string' },
});

function parsePositiveInteger(value, fieldName, defaultValue) {
  if (value == null || String(value).trim() === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return parsed;
}

export async function resolveDockerProviderAcceptanceInputs({
  args = process.argv.slice(2),
  env = process.env,
  readFileFn,
} = {}) {
  const { values } = parseStrictScriptOptions(validateDockerProviderAcceptanceCliOptions, {
    allowPositionals: true,
    args,
  });

  const timeoutMs = parsePositiveInteger(
    values['timeout-ms'] ?? env.HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_TIMEOUT_MS,
    'timeout-ms',
    15_000,
  );
  const evidencePath = getOptionalStringInput(
    values,
    'evidence-path',
    dockerProviderAcceptanceEvidencePathEnvVar,
    env,
  ) ?? getOptionalDockerSmokeEvidencePath(env);

  return {
    baseUrl: getOptionalStringInput(values, 'base-url', 'HARMONIARR_BASE_URL', env)
      ?? defaultDockerProviderAcceptanceBaseUrl,
    evidencePath,
    headless: getBooleanInput(values, 'headless', 'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_HEADLESS', env, true),
    password: await getRequiredSecretInput({
      env,
      envName: 'HARMONIARR_WALKTHROUGH_PASSWORD',
      fileEnvName: dockerProviderAcceptancePasswordFileEnvVar,
      fileOptionName: 'password-file',
      optionName: 'password',
      readFileFn,
      values,
    }),
    requireAcceptedTransfer: getBooleanInput(
      values,
      'require-accepted-transfer',
      'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_REQUIRE_ACCEPTED_TRANSFER',
      env,
      false,
    ),
    requireConfiguredProvider: getBooleanInput(
      values,
      'require-configured-provider',
      'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_REQUIRE_CONFIGURED_PROVIDER',
      env,
      true,
    ),
    requireDiagnostic: getBooleanInput(
      values,
      'require-diagnostic',
      'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_REQUIRE_DIAGNOSTIC',
      env,
      true,
    ),
    requireMusicQueueLink: getBooleanInput(
      values,
      'require-music-queue-link',
      'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_REQUIRE_MUSIC_QUEUE_LINK',
      env,
      false,
    ),
    requirePathMapping: getBooleanInput(
      values,
      'require-path-mapping',
      'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_REQUIRE_PATH_MAPPING',
      env,
      true,
    ),
    screenshotDir: getOptionalStringInput(
      values,
      'screenshot-dir',
      'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_SCREENSHOT_DIR',
      env,
    ),
    timeoutMs,
    username: getRequiredStringInput(values, 'username', 'HARMONIARR_WALKTHROUGH_USERNAME', env),
  };
}

export async function runDockerProviderAcceptanceFromEnvironment(env = process.env, {
  args = process.argv.slice(2),
} = {}) {
  const inputs = await resolveDockerProviderAcceptanceInputs({ args, env });
  return runDockerProviderAcceptanceEvidence(inputs);
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-validate-docker-provider-acceptance',
  renderSuccessMessage: renderDockerProviderAcceptanceSuccessMessage,
  run: () => runDockerProviderAcceptanceFromEnvironment(),
});
