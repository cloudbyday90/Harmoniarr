/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createRecoveryDockerCommand } from '../../scripts/postgres-recovery-command.js';
import { assertLocalRecoveryDocker } from '../../scripts/postgres-recovery-runtime.js';
import { createPostgresIntegrationRuntime } from '../postgres-integration-runtime.js';

const label = 'io.harmoniarr.manual-history';

/** A fresh local database with explicit loopback publishing and exact cleanup ownership. */
export async function createManualPostgresRuntime(options) {
  const runDocker = createRecoveryDockerCommand();
  await assertLocalRecoveryDocker({ runDocker });
  const version = (await runDocker(['version', '--format', '{{.Server.Version}}'])).stdout.trim();
  assert.ok(Number.parseInt(version, 10) >= 28, 'manual fixture requires Docker Engine 28+ for localhost publishing');
  const nonce = randomUUID(); const name = `harmoniarr-manual-history-${nonce}`;
  const password = randomBytes(32).toString('base64url');
  let attempted = false; let containerId; let port;
  async function inspectOwned() {
    const [container] = JSON.parse((await runDocker(['container', 'inspect', name])).stdout);
    assert.equal(container.Name, `/${name}`); assert.equal(container.Config.Labels[label], nonce);
    assert.match(container.Id, /^[a-f0-9]{64}$/u);
    if (containerId) assert.equal(container.Id, containerId);
    return container;
  }
  async function removeContainer() {
    if (!attempted) return;
    const listed = (await runDocker(['container', 'ls', '--all', '--filter', `label=${label}=${nonce}`, '--format', '{{.ID}}'])).stdout.trim();
    if (listed) {
      const container = await inspectOwned();
      await runDocker(['container', 'rm', '--force', '--volumes', container.Id]);
    }
    assert.equal((await runDocker(['container', 'ls', '--all', '--filter', `label=${label}=${nonce}`, '--format', '{{.ID}}'])).stdout.trim(), '');
  }
  try {
    return await createPostgresIntegrationRuntime({ ...options, config: { ...options.config, useContainerReuse: false }, env: {},
      createPostgresContainer: config => ({ async start() {
        attempted = true;
        containerId = (await runDocker(['run', '--detach', '--name', name, '--label', `${label}=${nonce}`, '--publish', '127.0.0.1::5432',
          '--env', 'POSTGRES_PASSWORD', '--env', 'POSTGRES_USER=harmoniarr', '--env', 'POSTGRES_DB=harmoniarr',
          '--memory', '512m', '--cpus', '2', '--pids-limit', '128', '--security-opt', 'no-new-privileges:true',
          '--health-cmd', 'pg_isready -U harmoniarr -d harmoniarr', '--health-interval', '1s', '--health-timeout', '3s', '--health-retries', '60',
          config.postgresImage], { environment: { POSTGRES_PASSWORD: password }, timeoutMs: config.startupTimeoutMs })).stdout.trim();
        const container = await inspectOwned();
        const bindings = container.NetworkSettings.Ports['5432/tcp'];
        assert.equal(bindings.length, 1); assert.equal(bindings[0].HostIp, '127.0.0.1');
        port = Number(bindings[0].HostPort); assert.ok(Number.isInteger(port) && port > 0 && port <= 65535);
        assert.equal(container.Mounts.some(mount => mount.Type === 'bind'), false);
        const deadline = Date.now() + config.startupTimeoutMs;
        while (true) {
          const current = await inspectOwned();
          if (current.State.Health?.Status === 'healthy') break;
          assert.equal(current.State.Running, true, 'manual PostgreSQL stopped during startup');
          assert.ok(Date.now() < deadline, 'manual PostgreSQL did not become ready');
          await delay(250);
        }
        return { getId: () => containerId, getHost: () => '127.0.0.1', getDatabase: () => 'harmoniarr',
          getUsername: () => 'harmoniarr', getPassword: () => password, getPort: () => port, stop: removeContainer };
      } }),
    });
  } catch (error) {
    // A failed run/start can still have created the exact named, labeled container.
    try { await removeContainer(); } catch { /* Retain the original setup Error/null. */ }
    throw error;
  }
}
