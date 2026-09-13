/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { isIP } from 'node:net';

export const MAX_PUSH_ENDPOINT_BYTES = 4096;
const reservedSuffixes = new Set(['localhost', 'local', 'internal', 'home', 'lan', 'localdomain', 'arpa', 'onion', 'test', 'invalid', 'example']);

/** Product policy for public browser push services; never rewrites the stored capability. */
export function parsePushEndpoint(endpoint) {
  try {
    if (typeof endpoint !== 'string' || endpoint.length === 0 || endpoint.length > MAX_PUSH_ENDPOINT_BYTES
      || Buffer.byteLength(endpoint, 'utf8') > MAX_PUSH_ENDPOINT_BYTES || /[\s\\#]/u.test(endpoint)
      || [...endpoint].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error();
    const authority = /^https:\/\/([^/?#]+)(?:[/?]|$)/i.exec(endpoint)?.[1];
    if (!authority || !/^[a-z0-9.-]+(?::443)?$/i.test(authority)) throw new Error();
    const parsed = new URL(endpoint);
    const hostname = parsed.hostname;
    const labels = hostname.split('.');
    if (parsed.protocol !== 'https:' || parsed.port || parsed.username || parsed.password || parsed.hash
      || isIP(hostname) || hostname.length > 253 || labels.length < 2
      || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))
      || reservedSuffixes.has(labels.at(-1))) throw new Error();
    return parsed;
  } catch {
    throw Object.assign(new Error('Push endpoint must use an eligible HTTPS hostname on port 443'), { code: 'push_endpoint_invalid' });
  }
}
