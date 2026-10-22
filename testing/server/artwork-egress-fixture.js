/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { request } from 'node:https';
import { createPublicDestinationResolver } from '../../src/server/network/public-destination-resolver.js';
import { createArtworkImageTransport } from '../../src/server/artwork/artwork-image-transport.js';

/** Inspect the production pin, then reroute only to the owned loopback TLS port. */
export function createArtworkEgressFixture({ resolve4 = async () => ['93.184.216.34'],
  resolve6 = async () => ['2606:4700:4700::1111'], fallback = false } = {}) {
  const port = Number(process.env.HARMONIARR_TEST_HTTPS_PORT);
  assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
  const pins = []; const dns = []; const sockets = [];
  const destinationResolver = createPublicDestinationResolver({ createResolverFn: () => ({
    resolve4: hostname => { dns.push([hostname, 4]); return resolve4(hostname); },
    resolve6: hostname => { dns.push([hostname, 6]); return resolve6(hostname); }, cancel() {},
  }) });
  const transport = createArtworkImageTransport({ destinationResolver, requestFn(url, options, callback) {
    assert.equal(options.servername, url.hostname); assert.equal(options.headers.Host, url.host);
    assert.equal(options.rejectUnauthorized, true); assert.equal(options.family, 0); assert.equal(options.autoSelectFamily, true);
    assert.equal(options.agent.options.keepAlive, false); assert.deepEqual(options.agent.options.proxyEnv, {});
    options.lookup(url.hostname, { all: true }, (error, addresses) => { assert.equal(error, null); pins.push(addresses); });
    assert.ok(pins.at(-1).length > 0);
    const outgoing = request(url, { ...options, hostname: '127.0.0.1', port, agent: false,
      lookup: (_hostname, input, done) => {
        const addresses = fallback ? [{ address: '127.0.0.2', family: 4 }, { address: '127.0.0.1', family: 4 }]
          : [{ address: '127.0.0.1', family: 4 }];
        queueMicrotask(() => { done(null, input.all ? addresses : addresses[0].address, input.all ? undefined : 4); });
      },
      // A named fixture host forces Node to exercise its fixed test lookup.
      ...(fallback ? { hostname: url.hostname } : {}),
    }, callback);
    outgoing.on('socket', socket => { sockets.push(socket); });
    return outgoing;
  } });
  return { fetchImpl: transport.fetchImage, pins, dns, sockets };
}
