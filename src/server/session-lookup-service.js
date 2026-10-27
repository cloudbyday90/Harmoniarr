/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { findRefreshTokenSession } from './auth-session-store.js';
import { startSessionLookup } from './session-lookup-owner-service.js';
import { withRequestReadSignal } from './request-read-signal-service.js';

export function readRefreshTokenSession(tokenHash, options) {
  return startSessionLookup(client => findRefreshTokenSession(client, tokenHash), options).result;
}

/** Response close, rather than normal GET request close, cancels authorization reads. */
export function readRequestSessionRow(request, tokenHash, readFn = readRefreshTokenSession) {
  return withRequestReadSignal(request, signal => readFn(tokenHash, { signal }));
}
