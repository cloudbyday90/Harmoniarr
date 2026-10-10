/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

import { createServer } from 'node:http';

const reply = (response, status, body) => {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
};

async function readRecord(request) {
  let size = 0; const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 2048) throw Object.assign(new Error('Control record is too large'), { code: 'fixture_parent_record_too_large' });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function createParentPostgresControlServer({ registry } = {}) {
  if (typeof registry?.authenticate !== 'function' || typeof registry.dispatch !== 'function') {
    throw new TypeError('Control server requires its registry');
  }
  const active = new Set(); let closing = false;
  const server = createServer((request, response) => {
    const operation = (async () => {
      if (closing) return reply(response, 503, { version: 1, ok: false, code: 'fixture_parent_closed' });
      if (request.method !== 'POST' || request.url !== '/fixture-database') {
        return reply(response, 405, { version: 1, ok: false, code: 'fixture_parent_protocol_invalid' });
      }
      const authorization = request.headers.authorization;
      const token = typeof authorization === 'string' && /^Bearer [a-f0-9]{64}$/u.test(authorization)
        ? authorization.slice(7) : '';
      if (!registry.authenticate(token)) return reply(response, 401, { version: 1, ok: false, code: 'fixture_parent_unauthorized' });
      if (request.headers['content-type'] !== 'application/json') {
        return reply(response, 400, { version: 1, ok: false, code: 'fixture_parent_protocol_invalid' });
      }
      try {
        const result = await registry.dispatch(token, await readRecord(request));
        reply(response, 200, { version: 1, ok: true, result });
      } catch (error) {
        const code = typeof error?.code === 'string' && /^fixture_parent_[a-z_]{1,60}$/u.test(error.code)
          ? error.code : 'fixture_parent_protocol_invalid';
        reply(response, code === 'fixture_parent_record_too_large' ? 413 : 400, { version: 1, ok: false, code });
      }
    })();
    active.add(operation);
    operation.catch(() => { response.destroy(); }).finally(() => active.delete(operation));
  });
  server.requestTimeout = 10_000; server.headersTimeout = 10_000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return {
    endpoint: `http://127.0.0.1:${server.address().port}/fixture-database`,
    async close() {
      closing = true;
      const closed = new Promise((resolve, reject) => { server.close((error) => { if (error) reject(error); else resolve(); }); });
      server.closeAllConnections();
      await Promise.allSettled([...active]);
      await closed;
    },
  };
}
