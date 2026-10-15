/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Seal synchronously; drain the actual isolated-database operation before runtime release. */
export function createFixtureRuntimeLifetime() {
  const active = new Set(); let sealed = false; let closing;
  function run(operation) {
    if (sealed) return Promise.reject(Object.assign(new Error('Fixture runtime admission closed'), { code: 'fixture_runtime_closed' }));
    const pending = Promise.resolve().then(operation); active.add(pending);
    pending.then(() => active.delete(pending), () => active.delete(pending));
    return pending;
  }
  function close(release) {
    sealed = true;
    return closing ??= (async () => { await Promise.allSettled([...active]); await release(); })();
  }
  return Object.freeze({ run, close });
}
