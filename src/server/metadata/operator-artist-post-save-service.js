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

import { createRuntimeReporter } from '../runtime-reporter.js';

const phases = new Set(['policy_activity', 'monitored_activity', 'notification', 'metadata_refresh', 'projection']);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Best-effort diagnostics must never turn an already committed save into a retry. */
export function createOperatorArtistPostSaveService({
  reporter = createRuntimeReporter({ prefix: 'harmoniarr-artist-save' }),
} = {}) {
  function report(phase, context) {
    try {
      void Promise.resolve(reporter.writeWarning(JSON.stringify({
        event: 'artist_post_save_failed',
        phase: phases.has(phase) ? phase : 'unknown',
        saveCommitted: true,
        snapshotId: typeof context?.snapshotId === 'string' && uuidPattern.test(context.snapshotId)
          ? context.snapshotId.toLowerCase() : null,
        snapshotRevision: Number.isSafeInteger(context?.snapshotRevision) && context.snapshotRevision >= 0
          ? context.snapshotRevision : null,
      }))).catch(() => {});
    } catch {
      // The diagnostic sink is not a second delivery channel or a save dependency.
    }
  }

  async function run(phase, task, context) {
    try {
      const result = await Promise.resolve().then(task);
      if (result?.recorded === false || (Number.isSafeInteger(result?.failed) && result.failed > 0)) {
        report(phase, context);
      }
      return result;
    } catch (error) {
      if (phase !== 'metadata_refresh' || error?.code !== 'metadata_artist_refresh_in_progress') {
        report(phase, context);
      }
      return null;
    }
  }

  return { run };
}
