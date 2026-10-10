/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

/** Test-owned lock holders always roll back and release their checked-out client. */
export async function withRollbackFixtureClient(pool, work) {
  if (typeof pool?.connect !== 'function' || typeof work !== 'function') throw new TypeError('Fixture lock holder requires a pool and callback');
  const client = await pool.connect();
  let result; let failed = false; let failure; let began = false; let discard = false;
  try { await client.query('BEGIN'); began = true; result = await work(client); }
  catch (error) { failed = true; failure = error; discard = !began; }
  if (began) {
    try { await client.query('ROLLBACK'); }
    catch (error) { discard = true; if (!failed) { failed = true; failure = error; } }
  }
  try { client.release(discard); }
  catch (error) { if (!failed) { failed = true; failure = error; } }
  if (failed) throw failure;
  return result;
}
