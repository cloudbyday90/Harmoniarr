/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

// Private queue, connection and startup serialization contracts are reviewed
// together. A semver-compatible update still needs implementation/native proof.
// See docs/POSTGRES_DRIVER_8231_DESIGN.md before changing this tuple.
export function supportsPgObserverVersions(driver, pool, protocol) {
  return driver === '8.23.1' && pool === '3.14.0' && protocol === '1.16.1';
}
