/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const controlledProviderApiKeySecretName = 'controlled_provider_api_key';

function requireNonEmptyString(value, fieldName) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${fieldName} must be a non-empty string`);
  }
  return value;
}

export function resolveControlledProviderApiKeySecretPath(secretDirectory) {
  return resolve(
    requireNonEmptyString(secretDirectory, 'secretDirectory'),
    controlledProviderApiKeySecretName,
  );
}

/**
 * Writes the ephemeral controlled-provider key for a single Compose project.
 * The caller owns the 0700 directory and removes it when validation ends.
 */
export async function writeControlledProviderApiKeySecret({
  apiKey,
  secretDirectory,
  writeFileFn = writeFile,
} = {}) {
  const secretPath = resolveControlledProviderApiKeySecretPath(secretDirectory);
  await writeFileFn(secretPath, `${requireNonEmptyString(apiKey, 'apiKey')}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  return secretPath;
}
