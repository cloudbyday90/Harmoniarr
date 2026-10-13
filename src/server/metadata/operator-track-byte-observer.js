/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
export function observeOperatorTrackBytes(callback, amount) {
  if (typeof callback !== 'function') return;
  try {
    const result = callback(amount);
    if (result && typeof result.then === 'function') Promise.resolve(result).catch(() => {});
  } catch { /* Optional byte telemetry never owns file evidence. */ }
}
