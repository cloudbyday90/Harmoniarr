/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, request } from 'node:https';
import { createArtworkImageTransport } from '../../src/server/artwork/artwork-image-transport.js';
import { createPublicDestinationResolver } from '../../src/server/network/public-destination-resolver.js';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import certificates from '../fixtures/provider-https/public-test-certificates.json' with { type: 'json' };

/** Fixed metadata, real image HTTPS; only the final destination is fixture-owned. */
export async function withDeploymentImageProvider(image, work) {
  const sockets = new Map(); let requests = 0; let connections = 0;
  const server = createServer(certificates.matched, (req, res) => {
    requests++; req.resume();
    res.writeHead(200, { 'Content-Type': image[0] === 0xff ? 'image/jpeg' : 'image/png', 'Content-Length': image.length, Connection: 'close' }); res.end(image);
  });
  server.on('connection', socket => {
    connections++; sockets.set(socket, new Promise(resolve => { socket.once('close', resolve); }));
    socket.on('error', () => {});
  });
  return withWorkerTaskCleanup(async () => {
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const port = server.address().port;
    const transport = createArtworkImageTransport({ env: {}, destinationResolver: createPublicDestinationResolver({
      createResolverFn: () => ({ resolve4: async () => ['93.184.216.34'], resolve6: async () => [], cancel() {} }),
    }), requestFn(url, options, callback) {
      assert.equal(url.hostname, 'assets.fanart.tv'); assert.equal(options.rejectUnauthorized, true);
      assert.equal(options.servername, url.hostname); assert.equal(options.headers.Host, url.host);
      assert.deepEqual(options.agent.options.proxyEnv, {});
      options.lookup(url.hostname, { all: true }, (error, answers) => {
        assert.equal(error, null); assert.deepEqual(answers, [{ address: '93.184.216.34', family: 4 }]);
      });
      return request(url, { ...options, hostname: '127.0.0.1', port, agent: false, ca: certificates.ca }, callback);
    } });
    return await work({ fetchImpl: transport.fetchImage, getState: () => ({ requests, connections }) });
  }, async () => {
    const closed = new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); });
    for (const socket of sockets.keys()) socket.destroy();
    await Promise.all([closed, ...sockets.values()]);
    assert.equal(server.listening, false); for (const socket of sockets.keys()) assert.equal(socket.closed, true);
  });
}
