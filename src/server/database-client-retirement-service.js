/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
/** Isolate the reviewed pg 8.23.1 transport surface; upgrades require native proof. */
export function createDatabaseClientRetirement(client) {
  let closing;
  return { close({ force = false } = {}) {
    // end() alone can wait for an idle/startup flush. Destroy only our owned transport.
    if (force) client.connection.stream.destroy();
    closing ??= client.end();
    return closing;
  } };
}
