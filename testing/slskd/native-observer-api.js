/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { readNativePartialApi } from './native-partial-api.js';

/** Fixed GET observations only; never hand the privileged key to download/search code. */
export function readNativeProviderObservation(config, path, { readFn = readNativePartialApi } = {}) {
  if (!['options', 'debug/transfers'].includes(path)) throw new TypeError('Unreviewed native observer path');
  return readFn({ baseUrl: config.baseUrl, apiKey: config.observerApiKey ?? config.apiKey, requestTimeoutMs: config.requestTimeoutMs }, path);
}
