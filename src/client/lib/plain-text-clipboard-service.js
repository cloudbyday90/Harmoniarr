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

/**
 * Writes supplied plain text only. Callers must invoke this from a direct user
 * interaction; this utility intentionally does not read from the clipboard or
 * provide a legacy document-copy fallback.
 */
export async function writePlainTextToClipboard(text, {
  clipboard = globalThis.navigator?.clipboard,
} = {}) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new TypeError('Clipboard text must be a non-empty string');
  }

  if (typeof clipboard?.writeText !== 'function') {
    throw new Error('Clipboard writing is unavailable');
  }

  await clipboard.writeText(text);
}
