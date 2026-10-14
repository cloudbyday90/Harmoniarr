/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Returned observation drains after close; optional sink failure never replaces its outcome. */
export async function closeMediaTransport({ executor, seedObserver, transportObserver, location,
  enabled, onRecord }) {
  try { if (executor) await seedObserver.measure('media_executor_close', null, () => executor.close()); }
  finally {
    if (enabled) {
      try { await onRecord({ ...location, backend: executor ? 'docker_cli' : 'local_tools',
        ownerCleanupSafe: executor ? executor.canRemoveWorkspace() : null,
        snapshot: executor ? transportObserver.snapshot() : null }); } catch { /* Optional diagnostic sink. */ }
    }
  }
}
