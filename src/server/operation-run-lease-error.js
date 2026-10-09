/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

export function isOperationRunLeaseLostError(error) {
  return error?.code === 'operation_run_lease_lost';
}
