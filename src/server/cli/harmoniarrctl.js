#!/usr/bin/env node
/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { exitCodes, writeAndExit } from './cli-runtime.js';
import { recoveryCommands } from './recovery-commands.js';

const subcommandGroups = Object.freeze({
  recovery: recoveryCommands,
});

function printUsage() {
  const lines = [
    'Usage: harmoniarrctl <group> <command> [options]',
    '',
    'Groups:',
    '  recovery            Bootstrap-admin recovery management',
    '',
    'Recovery commands:',
    '  recovery arm-bootstrap-admin    Arm a new bootstrap-admin recovery run',
    '  recovery bootstrap-admin-status Check current recovery status',
    '  recovery cancel-bootstrap-admin Cancel an active recovery run',
    '',
    'Options:',
    '  --json              Output in machine-readable JSON format',
    '  --force             Required to replace or cancel an active run',
    '  --reason <text>     Optional reason for audit context',
    '  --ttl-minutes <n>   Recovery code TTL (5-30 minutes, default 15)',
  ];

  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    writeAndExit({ textOutput: printUsage(), exitCode: exitCodes.success });
    return;
  }

  const groupName = args[0];
  const commandName = args[1];

  if (!groupName || !commandName) {
    writeAndExit({
      textError: `Error: group and command are required.\n\n${printUsage()}`,
      exitCode: exitCodes.invalidInput,
    });
    return;
  }

  const group = subcommandGroups[groupName];
  if (!group) {
    writeAndExit({
      textError: `Error: unknown group "${groupName}".\n\n${printUsage()}`,
      exitCode: exitCodes.invalidInput,
    });
    return;
  }

  const command = group[commandName];
  if (!command) {
    writeAndExit({
      textError: `Error: unknown command "${groupName} ${commandName}".\n\n${printUsage()}`,
      exitCode: exitCodes.invalidInput,
    });
    return;
  }

  await command({ args: args.slice(2) });
}

await main();
