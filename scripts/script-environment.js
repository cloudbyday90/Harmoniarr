/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function getOptionalEnv(name, env = process.env) {
  const value = env[name]?.trim();
  return value || null;
}

export function getRequiredEnv(name, env = process.env) {
  const value = getOptionalEnv(name, env);
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export function parseBooleanEnv(value, defaultValue = false) {
  if (value == null) {
    return defaultValue;
  }

  const normalizedValue = String(value).trim().toLowerCase();
  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  throw new Error(`Boolean environment value expected, received ${value}`);
}