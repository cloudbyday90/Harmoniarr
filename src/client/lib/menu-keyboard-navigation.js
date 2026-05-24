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

export function resolveMenuFocus(items, activeElement, key) {
  if (!items || items.length === 0) return null;

  const currentIndex = items.indexOf(activeElement);

  if (key === 'ArrowDown') {
    return items[currentIndex < items.length - 1 ? currentIndex + 1 : 0];
  }

  if (key === 'ArrowUp') {
    return items[currentIndex > 0 ? currentIndex - 1 : items.length - 1];
  }

  return null;
}
