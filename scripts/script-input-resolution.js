/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { parseScriptArguments } from './script-arguments.js';
import { getOptionalEnv, parseBooleanEnv } from './script-environment.js';

export function normalizeOptionalString(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

export function getOptionalStringInput(values, optionName, envName, env) {
  return normalizeOptionalString(values?.[optionName]) ?? getOptionalEnv(envName, env);
}

export function getRequiredStringInput(values, optionName, envName, env) {
  const value = getOptionalStringInput(values, optionName, envName, env);

  if (!value) {
    throw new Error(`${envName} is required`);
  }

  return value;
}

export function getBooleanInput(values, optionName, envName, env, defaultValue = false) {
  if (typeof values?.[optionName] === 'boolean') {
    return values[optionName];
  }

  return parseBooleanEnv(env?.[envName], defaultValue);
}

export function parseStrictScriptOptions(options, {
  allowPositionals = false,
  args = process.argv.slice(2),
} = {}) {
  return parseScriptArguments({
    allowNegative: true,
    allowPositionals,
    args,
    options,
    strict: true,
  });
}

export function parseNonNegativeIntegerInput({
  defaultValue = '0',
  env,
  envName,
  fieldName = envName,
  optionName,
  values,
} = {}) {
  const rawValue = normalizeOptionalString(values?.[optionName])
    ?? normalizeOptionalString(env?.[envName])
    ?? String(defaultValue);
  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }

  return parsed;
}

function normalizeStringList(value, separator) {
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => typeof entry === 'string' ? entry.split(separator) : [])
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(separator)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function getStringListInput({
  defaultValue = [],
  env,
  envName,
  optionName,
  separator = ',',
  values,
} = {}) {
  const cliValue = normalizeStringList(values?.[optionName], separator);
  if (cliValue.length > 0) {
    return cliValue;
  }

  const envValue = normalizeStringList(env?.[envName], separator);
  if (envValue.length > 0) {
    return envValue;
  }

  return [...defaultValue];
}

export function getRequiredStringListInput(options = {}) {
  const values = getStringListInput(options);

  if (values.length === 0) {
    throw new Error(`${options.envName} is required`);
  }

  return values;
}