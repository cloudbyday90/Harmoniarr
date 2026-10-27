/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { startSessionWriteTransaction, sessionWriteTimeoutMs } from './session-write-transaction-service.js';
export const sessionReplayTimeoutMs = sessionWriteTimeoutMs;
export function startSessionReplayTransaction(work, options = {}) {
  return startSessionWriteTransaction(work, { ...options, errorCode: 'session_replay_unavailable' });
}
