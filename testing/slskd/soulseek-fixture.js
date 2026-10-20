/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createHash } from 'node:crypto';
import { isIPv4 } from 'node:net';
import { openOwnedTcpServer } from './owned-tcp-server.js';
import { createWireDecoder, wireReader, wireFrame, wireInteger, wireString } from './wire-codec.js';
import { nativePeer } from './fixture-data.js';
import { openFixturePeer } from './soulseek-peer.js';
import { openNativeResumePeer } from './native-resume-peer.js';
import { openNativeRefusalPeer } from './native-refusal-peer.js';
import { openNativeAudioPeer } from './native-audio-peer.js';
import { createNativeSearchResponder } from './native-search-responder.js';

const byte = value => Buffer.from([value]);
// Released client startup/status messages that require no response in this fixture.
const notifications = new Set([2, 18, 32, 35, 36, 71, 100, 126, 127, 141]);

export async function openSoulseekFixture({ username, password, address = '127.0.0.1',
  host = '127.0.0.1', serverPort = 0, peerPort = 0, mode = 'batch', beforeReset } = {}) {
  if (!['batch', 'cancellation', 'files', 'partial', 'resume', 'refusal', 'audio'].includes(mode)) throw new TypeError('Unknown native fixture mode');
  if (['partial', 'resume', 'refusal'].includes(mode) && typeof beforeReset !== 'function') throw new TypeError('File fault modes require an incomplete-file checkpoint');
  if (!isIPv4(address) || typeof username !== 'string' || !username || typeof password !== 'string' || !password) {
    throw new TypeError('An owned IPv4 fixture and credentials are required');
  }
  const ip = Buffer.from(address.split('.').map(Number).reverse());
  const stats = { logins: 0, addresses: 0, peerConnections: 0, fileConnections: 0, requests: [], sentFiles: [], partialFiles: [], resumeFiles: [],
    refusalFiles: [], changedSizeResponses: [], searchRequests: [], searchResponses: [], refusalReasons: [], refused: 0 };
  const idleTimeout = mode === 'cancellation' ? 240_000 : 30_000;
  const refuse = error => {
    stats.refused += 1;
    if (error instanceof Error && stats.refusalReasons.length < 8) stats.refusalReasons.push(error.message);
  };
  const search = mode === 'audio' ? createNativeSearchResponder({ stats, refuse }) : null;
  function attach(socket, handle) {
    let messages = 0;
    const decoder = createWireDecoder(payload => {
      if (++messages > 128) throw new RangeError('Fixture connection message bound exceeded');
      handle(payload);
    });
    socket.on('data', chunk => {
      try { decoder.push(chunk); } catch (error) { refuse(error); socket.destroy(); }
    });
    socket.on('end', () => { try { decoder.end(); } catch (error) { refuse(error); } });
  }
  const openPeer = mode === 'audio' ? openNativeAudioPeer : mode === 'refusal' ? openNativeRefusalPeer : mode === 'resume' ? openNativeResumePeer : openFixturePeer;
  const peer = await openPeer({ username, host, port: peerPort, idleTimeout, mode, stats, refuse, beforeReset });
  let central;
  try {
    central = await openOwnedTcpServer({ host, port: serverPort, idleTimeout, onDrop: refuse, onSocket(socket) {
      let authenticated = false; let listenPort = null;
      attach(socket, payload => {
        const reader = wireReader(payload); const code = reader.integer();
        if (code === 1 && !authenticated) {
          if (reader.text() !== username || reader.text() !== password) throw new Error('Unexpected fixture login');
          reader.integer(); const hash = reader.text(); reader.integer(); reader.end();
          // MD5 is the reviewed legacy wire field, not a security primitive for the application.
          if (hash !== createHash('md5').update(username + password).digest('hex')) throw new Error('Invalid fixture login hash');
          authenticated = true; stats.logins += 1;
          socket.write(wireFrame(1, byte(1), wireString('Owned native fixture'), ip, wireString(hash), byte(0)));
        } else if (!authenticated) throw new Error('Fixture login is required');
        else if (code === 2 && search) {
          const announcedPort = reader.integer(); reader.end();
          if ((listenPort !== null && listenPort !== announcedPort) || announcedPort < 1024 || announcedPort > 65535) throw new Error('Unowned native search endpoint');
          listenPort = announcedPort;
        } else if (code === 26 && search) {
          const token = reader.integer(); const query = reader.text(); reader.end();
          void search.dispatch({ socket, port: listenPort, token, query });
        } else if (code === 36 && search) {
          const target = reader.text(); reader.end();
          if (target !== username) throw new Error('Unowned statistics target');
          socket.write(wireFrame(36, wireString(target), wireInteger(0), Buffer.alloc(8), wireInteger(0), wireInteger(0)));
        } else if (code === 3) {
          const target = reader.text(); reader.end();
          if (target !== nativePeer) throw new Error('Unexpected fixture peer');
          stats.addresses += 1;
          socket.write(wireFrame(3, wireString(target), ip, wireInteger(peer.port)));
        } else if (code === 7) {
          const target = reader.text(); reader.end();
          if (target !== nativePeer && target !== username) throw new Error('Unexpected status target');
          socket.write(wireFrame(7, wireString(target), wireInteger(2), byte(0)));
        } else if (code === 92) { reader.end(); socket.write(wireFrame(92, wireInteger(0))); }
        else if (!notifications.has(code)) throw new Error('Unexpected central operation');
      });
    } });
  } catch (error) { await peer.close(); throw error; }
  let closing;
  return {
    serverPort: central.port, peerPort: peer.port,
    snapshot: () => ({ ...stats, requests: [...stats.requests], sentFiles: [...stats.sentFiles], partialFiles: stats.partialFiles.map(row => ({ ...row })),
      resumeFiles: stats.resumeFiles.map(row => ({ ...row })),
      refusalFiles: stats.refusalFiles.map(row => ({ ...row })), changedSizeResponses: stats.changedSizeResponses.map(row => ({ ...row })),
      searchRequests: stats.searchRequests.map(row => ({ ...row })), searchResponses: stats.searchResponses.map(row => ({ ...row })),
      refusalReasons: [...stats.refusalReasons],
      activeSockets: central.active() + peer.active() + (search?.active() ?? 0) }),
    close() { closing ??= Promise.all([central.close(), peer.close(), search?.close()]).then(() => undefined); return closing; },
  };
}
