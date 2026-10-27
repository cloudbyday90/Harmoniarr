/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
/** Controlled response fixtures only; native HTTPS qualification uses the real transport. */
export function createPlexResponseTransport(fetchFn) {
  return { startRequest(url, options) {
    const result = Promise.resolve().then(async () => {
      const response = await fetchFn(url, options);
      return { status: response.status, headers: response.headers, body: Buffer.from(await response.arrayBuffer()) };
    });
    return { result, drained: result.then(() => true, () => true) };
  } };
}
