/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { stdin, stdout } from 'node:process';
import { createManualSessionInput } from './manual-session-input.js';

/** Own CLI input through setup and actual session retirement. */
export async function runManualMetadataHistory({ runSession, input = stdin, output = stdout } = {}) {
  if (typeof runSession !== 'function') throw new TypeError('Manual history requires a session owner.');
  const commands = createManualSessionInput({ input, output });
  try {
    await runSession(async ({ baseUrl, artistUrl, controller }) => {
      if (!commands.acceptCommands(command => controller.command(command))) return;
      output.write(`Manual history fixture: ${baseUrl}/bootstrap\n`);
      output.write('Open that URL in a new private browser window and create a disposable test account.\n');
      output.write(`Then open ${artistUrl}\n`);
      output.write('Synthetic pages: 10 initial, 10 continuing, 1 final. No provider commands are available.\n');
      output.write('Terminal: status | hold (next read) | release | fail (held/next read) | reset (then reload browser) | quit\n');
      output.write('Record actual AT/browser/device observations using docs/METADATA_HISTORY_MANUAL_ACCESSIBILITY.md.\n');
      await commands.stopped;
    }, { signal: commands.signal });
  } catch (error) {
    if (!commands.signal.aborted || error !== commands.signal.reason) throw error;
  } finally {
    commands.dispose();
    // This CLI owns the transport. Windows may otherwise retain a piped stdin
    // reference after readline closes. Do not force exit before cleanup/output.
    input.pause(); input.unref?.();
  }
  output.write('Manual history fixture retired. No manual accessibility pass is inferred.\n');
}
