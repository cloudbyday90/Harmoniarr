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

import { runCliTask } from './cli-runtime.js';
import { closePool } from './database.js';
import { createRuntimeReporter } from './runtime-reporter.js';

export async function runMigrationCli({
  prefix,
  processEmitter = process,
  renderSuccessMessage,
  run,
  stderr = process.stderr,
  stdout = process.stdout,
} = {}) {
  if (!prefix) {
    throw new Error('prefix is required');
  }

  if (typeof run !== 'function') {
    throw new Error('run is required');
  }

  if (typeof renderSuccessMessage !== 'function') {
    throw new Error('renderSuccessMessage is required');
  }

  const runtimeReporter = createRuntimeReporter({
    prefix,
    stderr,
    stdout,
  });

  await runCliTask({
    cleanup: closePool,
    onSuccess: async (result) => {
      runtimeReporter.writeInfo(renderSuccessMessage(result));
    },
    processEmitter,
    reporter: runtimeReporter,
    run,
  });
}