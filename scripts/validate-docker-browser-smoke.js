/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import {
  defaultDockerBrowserSmokeBaseUrl,
  renderDockerBrowserSmokeSuccessMessage,
  runDockerOperatorBrowserSmoke,
} from './docker-browser-smoke-validation.js';
import { getOptionalDockerSmokeEvidencePath } from './docker-smoke-evidence.js';
import { getRequiredSecretInput } from './secret-input.js';
import { getBooleanInput, getOptionalStringInput, getRequiredStringInput, parseStrictScriptOptions } from './script-input-resolution.js';
import { runDirectScriptTask } from './script-runtime.js';

export const dockerBrowserSmokeEvidencePathEnvVar = 'HARMONIARR_DOCKER_BROWSER_SMOKE_EVIDENCE_PATH';
export const dockerBrowserSmokePasswordFileEnvVar = 'HARMONIARR_WALKTHROUGH_PASSWORD_FILE';

export const validateDockerBrowserSmokeCliOptions = Object.freeze({
  'base-url': { type: 'string' },
  'evidence-path': { type: 'string' },
  headless: { type: 'boolean' },
  password: { type: 'string' },
  'password-file': { type: 'string' },
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

export async function resolveDockerBrowserSmokeInputs({
  args = process.argv.slice(2),
  env = process.env,
  readFileFn,
} = {}) {
  const { values } = parseStrictScriptOptions(validateDockerBrowserSmokeCliOptions, {
    allowPositionals: true,
    args,
  });

  const timeoutMs = parsePositiveInteger(values['timeout-ms'] ?? env.HARMONIARR_DOCKER_BROWSER_SMOKE_TIMEOUT_MS, 'timeout-ms', 15_000);
  const evidencePath = getOptionalStringInput(values, 'evidence-path', dockerBrowserSmokeEvidencePathEnvVar, env)
    ?? getOptionalDockerSmokeEvidencePath(env);

  return {
    baseUrl: getOptionalStringInput(values, 'base-url', 'HARMONIARR_BASE_URL', env) ?? defaultDockerBrowserSmokeBaseUrl,
    evidencePath,
    headless: getBooleanInput(values, 'headless', 'HARMONIARR_DOCKER_BROWSER_SMOKE_HEADLESS', env, true),
    password: await getRequiredSecretInput({
      env,
      envName: 'HARMONIARR_WALKTHROUGH_PASSWORD',
      fileEnvName: dockerBrowserSmokePasswordFileEnvVar,
      fileOptionName: 'password-file',
      optionName: 'password',
      readFileFn,
      values,
    }),
    screenshotDir: getOptionalStringInput(values, 'screenshot-dir', 'HARMONIARR_DOCKER_BROWSER_SMOKE_SCREENSHOT_DIR', env),
    timeoutMs,
    username: getRequiredStringInput(values, 'username', 'HARMONIARR_WALKTHROUGH_USERNAME', env),
  };
}

export async function runDockerBrowserSmokeFromEnvironment(env = process.env, {
  args = process.argv.slice(2),
} = {}) {
  const inputs = await resolveDockerBrowserSmokeInputs({ args, env });
  return runDockerOperatorBrowserSmoke(inputs);
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-validate-docker-browser-smoke',
  renderSuccessMessage: renderDockerBrowserSmokeSuccessMessage,
  run: () => runDockerBrowserSmokeFromEnvironment(),
});
