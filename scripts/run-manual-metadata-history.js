/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';
import { withManualHistorySession } from '../testing/manual/metadata-history-session.js';

if (process.argv.length > 2) throw new Error('This fixture accepts no host, port, database or provider arguments.');
const input = createInterface({ input: stdin, output: stdout, terminal: stdin.isTTY === true });
const lines = input[Symbol.asyncIterator]();
let stopped = false;
const stop = () => { stopped = true; input.close(); };
process.on('SIGINT', stop); process.on('SIGTERM', stop); input.on('SIGINT', stop);
try {
  await withManualHistorySession(async ({ baseUrl, artistUrl, controller }) => {
    if (stopped) return;
    console.log(`Manual history fixture: ${baseUrl}/bootstrap`);
    console.log('Open that URL in a new private browser window and create a disposable test account.');
    console.log(`Then open ${artistUrl}`);
    console.log('Synthetic pages: 10 initial, 10 continuing, 1 final. No provider commands are available.');
    console.log('Terminal: status | hold (next read) | release | fail (held/next read) | reset (then reload browser) | quit');
    console.log('Record actual AT/browser/device observations using docs/METADATA_HISTORY_MANUAL_ACCESSIBILITY.md.');
    for await (const line of lines) {
      const command = line.trim();
      if (command === 'quit' || stopped) break;
      if (!command) continue;
      try { console.log(JSON.stringify(controller.command(command))); }
      catch (error) { console.log(error.message); }
    }
  });
  console.log('Manual history fixture retired. No manual accessibility pass is inferred.');
} finally {
  input.close();
  process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); input.removeListener('SIGINT', stop);
}
