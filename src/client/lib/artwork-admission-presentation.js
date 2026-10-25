/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
const mib = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });
export function formatDiagnosticMiB(bytes) {
  if (!Number.isSafeInteger(bytes) || bytes < 0) return 'Unavailable';
  return bytes > 0 && bytes < 0.1 * 1024 ** 2 ? '<0.1 MiB' : `${mib.format(bytes / 1024 ** 2)} MiB`;
}
