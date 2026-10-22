/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export const maximumFanartDelayMs = 2_147_483_647;

export function resolveFanartTvRequestPolicy({ requestTimeoutMs, maxRetries }) {
  const timeout = requestTimeoutMs == null || requestTimeoutMs === '' ? 15000 : Number.parseInt(String(requestTimeoutMs), 10);
  const retries = Number(maxRetries ?? 2);
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > maximumFanartDelayMs || !Number.isSafeInteger(retries)) {
    throw new Error('Invalid Fanart.tv request policy');
  }
  return { requestTimeoutMs: timeout, maxRetries: Math.max(0, Math.min(retries, 10)) };
}
