/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

/** Keep render identity outside saved form data and scoped to its view owner. */
export function createSettingsRowKey() {
  const keys = new WeakMap();
  return row => {
    if (row === null || typeof row !== 'object') throw new TypeError('Settings rows require an object');
    let key = keys.get(row);
    if (!key) { key = Symbol(); keys.set(row, key); }
    return key;
  };
}
