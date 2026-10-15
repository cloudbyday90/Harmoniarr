/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
const modes = new Set(['empty', 'migration_template']);
export function resolveMusicQueueRecoverySchemaMode({ env = process.env, defaultMode = 'migration_template' } = {}) {
  if (!env || typeof env !== 'object' || Array.isArray(env) || !modes.has(defaultMode)) {
    throw new TypeError('Invalid recovery fixture schema policy');
  }
  const configured = env.HARMONIARR_INTEGRATION_RECOVERY_SCHEMA_MODE;
  const mode = configured === undefined ? defaultMode : configured;
  if (!modes.has(mode)) throw new TypeError('Recovery fixture schema mode must be empty or migration_template');
  return mode;
}
