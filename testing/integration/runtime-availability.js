/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export function isSkippableIntegrationRuntimeError(error) {
  const message = String(error?.message ?? '');
  return message.includes('Could not find a working container runtime strategy');
}

export function toIntegrationRuntimeUnavailableReason(error) {
  return `${error.message}. Configure external PostgreSQL env vars or start a supported container runtime for integration tests.`;
}
