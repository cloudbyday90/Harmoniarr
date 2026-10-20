/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { openSoulseekFixture } from './soulseek-fixture.js';
import { waitForNativePartial } from './native-partial-checkpoint.js';

const { username, password, mode } = JSON.parse(await readFile('/run/fixture.json', 'utf8'));
const addresses = Object.values(networkInterfaces()).flat().filter(row => row.family === 'IPv4' && !row.internal);
if (addresses.length !== 1) throw new Error('Native fixture requires exactly one private interface');
const fixture = await openSoulseekFixture({ username, password, address: addresses[0].address,
  host: '0.0.0.0', serverPort: 2271, peerPort: 2272, mode, ...(['partial', 'resume', 'refusal'].includes(mode) ? { beforeReset: waitForNativePartial } : {}) });
console.log(JSON.stringify({ kind: 'ready' }));
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  try { await fixture.close(); console.log(JSON.stringify({ kind: 'closed', ...fixture.snapshot() })); }
  catch { process.exitCode = 1; }
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
