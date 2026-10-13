/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
/** Each sample rolls back; this parent keeps one concrete connection for the pair. */
export async function withWantedProfileClient(pool, work) {
  const client = await pool.connect(); let discard = false; let failed = false; let failure; let result;
  const borrowed = { connect: async () => ({
    query: (...args) => client.query(...args),
    release: uncertain => { discard ||= Boolean(uncertain); },
  }) };
  try { result = await work(borrowed); } catch (error) { failed = true; failure = error; }
  try { client.release(discard); } catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  return result;
}
