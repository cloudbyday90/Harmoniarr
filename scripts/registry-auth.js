/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { getOptionalEnv } from './script-environment.js';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function resolveRegistryAuth(registryBinding, env = process.env) {
  if (!registryBinding || typeof registryBinding !== 'object' || Array.isArray(registryBinding)) {
    throw new Error('registryBinding must be an object');
  }

  const auth = registryBinding.auth;
  if (!auth || typeof auth !== 'object' || Array.isArray(auth)) {
    throw new Error('registryBinding.auth must be an object');
  }

  const tokenEnvName = isNonEmptyString(auth.tokenEnvName) ? auth.tokenEnvName.trim() : null;
  const usernameEnvName = isNonEmptyString(auth.usernameEnvName) ? auth.usernameEnvName.trim() : null;
  const password = tokenEnvName ? getOptionalEnv(tokenEnvName, env) : null;
  const username = usernameEnvName ? getOptionalEnv(usernameEnvName, env) : null;

  if ((username && !password) || (!username && password)) {
    throw new Error(`Registry ${registryBinding.key} requires both ${usernameEnvName} and ${tokenEnvName} when either credential is provided`);
  }

  if (auth.required && (!username || !password)) {
    throw new Error(`Registry ${registryBinding.key} requires ${usernameEnvName} and ${tokenEnvName}`);
  }

  return {
    password,
    required: Boolean(auth.required),
    tokenEnvName,
    username,
    usernameEnvName,
  };
}

export function buildOrasRegistryAuthArgs({
  prefix = null,
  registryAuth,
} = {}) {
  if (!registryAuth || typeof registryAuth !== 'object' || Array.isArray(registryAuth)) {
    throw new Error('registryAuth must be an object');
  }

  if (!registryAuth.username && !registryAuth.password) {
    return [];
  }

  const normalizedPrefix = isNonEmptyString(prefix) ? `${prefix.trim()}-` : '';
  return [
    `--${normalizedPrefix}username`,
    registryAuth.username,
    `--${normalizedPrefix}password`,
    registryAuth.password,
  ];
}