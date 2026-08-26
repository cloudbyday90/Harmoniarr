/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getBooleanInput } from './script-input-resolution.js';

export const providerAcceptanceReadinessOnlyEnvVar = 'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_READINESS_ONLY';

const requirementInputs = Object.freeze([
  {
    envName: 'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_REQUIRE_ACCEPTED_TRANSFER',
    fallback: false,
    optionName: 'require-accepted-transfer',
    propertyName: 'requireAcceptedTransfer',
  },
  {
    envName: 'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_REQUIRE_CONFIGURED_PROVIDER',
    fallback: true,
    optionName: 'require-configured-provider',
    propertyName: 'requireConfiguredProvider',
  },
  {
    envName: 'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_REQUIRE_DIAGNOSTIC',
    fallback: true,
    optionName: 'require-diagnostic',
    propertyName: 'requireDiagnostic',
  },
  {
    envName: 'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_REQUIRE_MUSIC_QUEUE_LINK',
    fallback: false,
    optionName: 'require-music-queue-link',
    propertyName: 'requireMusicQueueLink',
  },
  {
    envName: 'HARMONIARR_DOCKER_PROVIDER_ACCEPTANCE_REQUIRE_PATH_MAPPING',
    fallback: true,
    optionName: 'require-path-mapping',
    propertyName: 'requirePathMapping',
  },
]);

const readinessOnlyRequirements = Object.freeze({
  requireAcceptedTransfer: false,
  requireConfiguredProvider: true,
  requireDiagnostic: false,
  requireMusicQueueLink: false,
  requirePathMapping: true,
});

function getRequirementValues(values, env) {
  return Object.fromEntries(requirementInputs.map((input) => [
    input.propertyName,
    getBooleanInput(values, input.optionName, input.envName, env, input.fallback),
  ]));
}

function isExplicitlyEnabled(values, env, input) {
  if (values?.[input.optionName] === true) {
    return true;
  }

  return Object.hasOwn(env, input.envName)
    && getBooleanInput({}, input.optionName, input.envName, env, false) === true;
}

function isExplicitlyDisabled(values, env, input) {
  if (values?.[input.optionName] === false) {
    return true;
  }

  return Object.hasOwn(env, input.envName)
    && getBooleanInput({}, input.optionName, input.envName, env, true) === false;
}

function findRequirementInput(propertyName) {
  return requirementInputs.find((input) => input.propertyName === propertyName);
}

function assertReadinessOnlyRequirements(values, env) {
  const incompatibleEnabledOptions = [
    findRequirementInput('requireAcceptedTransfer'),
    findRequirementInput('requireDiagnostic'),
    findRequirementInput('requireMusicQueueLink'),
  ]
    .filter((input) => isExplicitlyEnabled(values, env, input))
    .map((input) => `--${input.optionName}`);

  if (incompatibleEnabledOptions.length > 0) {
    throw new Error(`--readiness-only cannot be combined with ${incompatibleEnabledOptions.join(', ')}`);
  }

  const requiredDisabledOptions = [
    findRequirementInput('requireConfiguredProvider'),
    findRequirementInput('requirePathMapping'),
  ]
    .filter((input) => isExplicitlyDisabled(values, env, input))
    .map((input) => `--no-${input.optionName}`);

  if (requiredDisabledOptions.length > 0) {
    throw new Error(`--readiness-only requires provider configuration and path mapping; remove ${requiredDisabledOptions.join(' and ')}`);
  }
}

/**
 * Resolves the acceptance evidence requirements for a command invocation.
 * Readiness-only mode is intentionally read-only: it verifies configuration
 * prerequisites but does not claim or require provider execution evidence.
 */
export function resolveDockerProviderAcceptanceRequirements({
  env = process.env,
  values = {},
} = {}) {
  const readinessOnly = getBooleanInput(
    values,
    'readiness-only',
    providerAcceptanceReadinessOnlyEnvVar,
    env,
    false,
  );

  if (!readinessOnly) {
    return getRequirementValues(values, env);
  }

  assertReadinessOnlyRequirements(values, env);
  return { ...readinessOnlyRequirements };
}

export function isDockerProviderReadinessOnly(requirements = {}) {
  return requirementInputs.every((input) => (
    requirements[input.propertyName] === readinessOnlyRequirements[input.propertyName]
  ));
}
