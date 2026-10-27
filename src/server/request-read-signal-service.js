/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
/** Normal request/body completion does not cancel a response-owned read. */
export async function withRequestReadSignal(request, read) {
  const controller = new AbortController(), response = request.res;
  const disconnected = () => { if (!response.writableFinished) controller.abort(); };
  if (request.aborted || response?.destroyed) controller.abort();
  response?.once('close', disconnected);
  try { return await read(controller.signal); }
  finally { response?.off('close', disconnected); }
}
