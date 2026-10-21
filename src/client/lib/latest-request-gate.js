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

export function createLatestRequestGate() {
  let latestRequestId = 0;
  let activeAbortController = null;

  function abortActiveRequest() {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
  }

  function capture() {
    const requestId = latestRequestId;
    return {
      isCurrent: () => requestId === latestRequestId,
      signal: activeAbortController?.signal,
    };
  }

  return {
    capture,
    begin() {
      abortActiveRequest();
      latestRequestId += 1;
      activeAbortController = typeof AbortController === 'function'
        ? new AbortController()
        : null;

      return capture();
    },

    invalidate() {
      abortActiveRequest();
      latestRequestId += 1;
    },
  };
}