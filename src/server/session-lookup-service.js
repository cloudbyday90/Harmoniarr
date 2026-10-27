/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { findRefreshTokenSession } from './auth-session-store.js';
import { startSessionLookup } from './session-lookup-owner-service.js';

export function readRefreshTokenSession(tokenHash, options) {
  return startSessionLookup(client => findRefreshTokenSession(client, tokenHash), options).result;
}

/** Response close, rather than normal GET request close, cancels authorization reads. */
export async function readRequestSessionRow(request, tokenHash, readFn = readRefreshTokenSession) {
  const controller = new AbortController(), response = request.res;
  const disconnected = () => { if (!response.writableFinished) controller.abort(); };
  if (request.aborted || response?.destroyed) controller.abort();
  response?.once('close', disconnected);
  try { return await readFn(tokenHash, { signal: controller.signal }); }
  finally { response?.off('close', disconnected); }
}
