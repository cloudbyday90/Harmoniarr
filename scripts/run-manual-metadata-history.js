/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { createManualSessionInput } from '../testing/manual/manual-session-input.js';
import { stdin } from 'node:process';
import { withManualHistorySession } from '../testing/manual/metadata-history-session.js';

if (process.argv.length > 2) throw new Error('This fixture accepts no host, port, database or provider arguments.');
const input = createManualSessionInput();
try {
  await withManualHistorySession(async ({ baseUrl, artistUrl, controller }) => {
    if (!input.acceptCommands(command => controller.command(command))) return;
    console.log(`Manual history fixture: ${baseUrl}/bootstrap`);
    console.log('Open that URL in a new private browser window and create a disposable test account.');
    console.log(`Then open ${artistUrl}`);
    console.log('Synthetic pages: 10 initial, 10 continuing, 1 final. No provider commands are available.');
    console.log('Terminal: status | hold (next read) | release | fail (held/next read) | reset (then reload browser) | quit');
    console.log('Record actual AT/browser/device observations using docs/METADATA_HISTORY_MANUAL_ACCESSIBILITY.md.');
    await input.stopped;
  }, { signal: input.signal });
} catch (error) {
  if (!input.signal.aborted || error !== input.signal.reason) throw error;
} finally {
  input.dispose();
  // Windows can retain a piped stdin handle after readline closes. This CLI
  // owns that transport; release its event-loop reference without forced exit.
  stdin.pause(); stdin.unref?.();
}
console.log('Manual history fixture retired. No manual accessibility pass is inferred.');
