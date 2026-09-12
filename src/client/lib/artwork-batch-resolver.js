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

const BATCH_LIMIT = 50;
const CONCURRENCY_LIMIT = 2;

/** One resolver shares its request limit across overlapping consumer calls. */
export function createArtworkBatchResolver({ batchResolveFn }) {
  let active = 0;
  const waiting = [];

  async function acquire() {
    if (active < CONCURRENCY_LIMIT) {
      active += 1;
      return;
    }
    await new Promise((resolve) => { waiting.push(resolve); });
  }

  function release() {
    const next = waiting.shift();
    if (next) next(); // Transfer the occupied slot without opening a race for another caller.
    else active -= 1;
  }

  async function resolveBatches(requests, { onResolved = () => {}, shouldContinue = () => true } = {}) {
    const items = Array.isArray(requests) ? requests : [];
    const totalBatches = Math.ceil(items.length / BATCH_LIMIT);
    let cursor = 0;
    let completedBatches = 0;
    let failedBatches = 0;

    async function worker() {
      while (cursor < items.length && shouldContinue()) {
        const batch = items.slice(cursor, cursor + BATCH_LIMIT);
        cursor += BATCH_LIMIT;
        await acquire();
        try {
          if (!shouldContinue()) return;
          let result;
          try {
            result = await batchResolveFn(batch);
          } catch {
            if (shouldContinue()) failedBatches += 1;
            continue;
          }
          if (!shouldContinue()) return;
          onResolved(result?.resolved ?? {});
          completedBatches += 1;
        } finally {
          release();
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY_LIMIT, totalBatches) }, worker));
    return { completedBatches, failedBatches, cancelledBatches: totalBatches - completedBatches - failedBatches };
  }

  return { resolveBatches };
}
