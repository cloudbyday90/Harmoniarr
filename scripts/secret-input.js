/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { readFile } from 'node:fs/promises';

import { getOptionalStringInput, normalizeOptionalString } from './script-input-resolution.js';

function createSecretFileReadError(fileEnvName) {
  return new Error(`${fileEnvName} could not be read`);
}

/**
 * Resolves an optional sensitive CLI input from exactly one source. File
 * contents stay in memory only and are intentionally not included in errors or
 * result metadata. Direct inputs remain supported for backward compatibility.
 *
 * @param {{ env?: object, envName: string, fileEnvName: string, fileOptionName: string, optionName: string, readFileFn?: typeof readFile, values?: object }} options
 * @returns {Promise<string | null>}
 */
export async function getOptionalSecretInput({
  env = process.env,
  envName,
  fileEnvName,
  fileOptionName,
  optionName,
  readFileFn = readFile,
  values = {},
} = {}) {
  const directValue = getOptionalStringInput(values, optionName, envName, env);
  const filePath = getOptionalStringInput(values, fileOptionName, fileEnvName, env);

  if (directValue && filePath) {
    throw new Error(`Configure only one of ${envName} or ${fileEnvName}`);
  }

  if (directValue) {
    return directValue;
  }

  if (!filePath) {
    return null;
  }

  let contents;
  try {
    contents = await readFileFn(filePath, 'utf8');
  } catch {
    throw createSecretFileReadError(fileEnvName);
  }

  const secret = normalizeOptionalString(contents);
  if (!secret) {
    throw createSecretFileReadError(fileEnvName);
  }

  return secret;
}

/**
 * Resolves a required sensitive CLI input from exactly one source.
 *
 * @param {{ env?: object, envName: string, fileEnvName: string, fileOptionName: string, optionName: string, readFileFn?: typeof readFile, values?: object }} options
 * @returns {Promise<string>}
 */
export async function getRequiredSecretInput(options = {}) {
  const secret = await getOptionalSecretInput(options);

  if (secret) {
    return secret;
  }

  throw new Error(`${options.envName} or ${options.fileEnvName} is required`);
}
