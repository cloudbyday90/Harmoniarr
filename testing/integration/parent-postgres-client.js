/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

export const parentPostgresEnvironmentKeys = Object.freeze({ mode: 'HARMONIARR_TEST_PG_MODE',
  endpoint: 'HARMONIARR_TEST_PG_ENDPOINT', token: 'HARMONIARR_TEST_PG_TOKEN' });

export function parentPostgresClientError(code = 'fixture_parent_transport_failed') {
  return Object.assign(new Error('The owned PostgreSQL fixture registration could not be verified'), { code });
}

export function createParentPostgresClient({ env = process.env, fetchFn = fetch, pid = process.pid,
  timeoutMs = 10_000 } = {}) {
  const values = Object.values(parentPostgresEnvironmentKeys).map((key) => env[key]);
  if (values.every((value) => value === undefined)) return null;
  const [mode, endpoint, token] = values;
  let url;
  try { url = new URL(endpoint); }
  catch { throw parentPostgresClientError('fixture_parent_configuration_invalid'); }
  if (mode !== 'parent' || typeof token !== 'string' || !/^[a-f0-9]{64}$/u.test(token)
    || url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port
    || url.username || url.password || url.search || url.hash || url.pathname !== '/fixture-database'
    || typeof fetchFn !== 'function' || !Number.isSafeInteger(pid) || pid < 1 || pid > 2_147_483_647
    || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw parentPostgresClientError('fixture_parent_configuration_invalid');

  async function request(action, input = {}) {
    let response;
    try {
      response = await fetchFn(url.href, { method: 'POST', headers: {
        authorization: `Bearer ${token}`, 'content-type': 'application/json',
      }, body: JSON.stringify({ version: 1, action, pid, ...input }), signal: AbortSignal.timeout(timeoutMs) });
      let size = 0; const chunks = [];
      if (!response.body) throw parentPostgresClientError();
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 4096) throw parentPostgresClientError();
        chunks.push(Buffer.from(chunk));
      }
      const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (result?.version !== 1 || typeof result.ok !== 'boolean') throw parentPostgresClientError();
      if (!response.ok || !result.ok) {
        const code = typeof result.code === 'string' && /^fixture_parent_[a-z_]{1,60}$/u.test(result.code)
          ? result.code : 'fixture_parent_transport_failed';
        throw parentPostgresClientError(code);
      }
      return result.result;
    } catch (error) {
      if (typeof error?.code === 'string' && /^fixture_parent_[a-z_]{1,60}$/u.test(error.code)) throw error;
      throw parentPostgresClientError();
    }
  }

  return {
    async reserve(kind) {
      const result = await request('reserve', { kind });
      if (typeof result?.databaseName !== 'string' || !/^[a-z][a-z0-9_]{0,62}$/u.test(result.databaseName)) throw parentPostgresClientError();
      return result.databaseName;
    },
    commit: (databaseName, oid) => identityRequest('commit', databaseName, oid),
    assertOwned: (databaseName, oid) => identityRequest('assert', databaseName, oid),
    async release(databaseName, oid) {
      const result = await request('release', { databaseName, oid });
      if (result?.released !== true) throw parentPostgresClientError();
      return result;
    },
    async abandon(databaseName) {
      const result = await request('abandon', { databaseName });
      if (result?.abandoned !== true) throw parentPostgresClientError();
      return result;
    },
  };
  async function identityRequest(action, databaseName, oid) {
    const result = await request(action, { databaseName, oid });
    if (result?.databaseName !== databaseName || result?.oid !== oid) throw parentPostgresClientError();
    return result;
  }
}
