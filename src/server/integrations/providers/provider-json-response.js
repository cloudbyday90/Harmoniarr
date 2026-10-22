/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { invalidProviderJsonResponse, readBoundedProviderJson } from '../bounded-json-response.js';

export async function readBoundedJsonResponse(response, { maxResponseBytes = 2_000_000, signal = null } = {}) {
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1 || maxResponseBytes > 2_000_000) {
    throw invalidProviderJsonResponse();
  }
  return readBoundedProviderJson(response, { maxResponseBytes, signal });
}
