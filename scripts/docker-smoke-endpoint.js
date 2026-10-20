/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

const endpointFailure = 'Docker smoke endpoint must have one assigned loopback TCP binding and no other published ports';

export function parseDockerSmokePortBindings(stdout) {
  if (typeof stdout !== 'string' || stdout.length > 4096) throw new Error(endpointFailure);
  let ports;
  try { ports = JSON.parse(stdout); }
  catch { throw new Error(endpointFailure); }
  if (!ports || typeof ports !== 'object' || Array.isArray(ports)) throw new Error(endpointFailure);
  const bindings = ports['3000/tcp'];
  if (!Array.isArray(bindings) || bindings.length !== 1
    || Object.entries(ports).some(([key, value]) => key !== '3000/tcp' && value !== null)) {
    throw new Error(endpointFailure);
  }
  const binding = bindings[0];
  if (binding?.HostIp !== '127.0.0.1' || typeof binding.HostPort !== 'string'
    || !/^[1-9][0-9]{0,4}$/u.test(binding.HostPort) || Number(binding.HostPort) > 65535) {
    throw new Error(endpointFailure);
  }
  const port = Number(binding.HostPort);
  return { baseUrl: `http://127.0.0.1:${port}`, port };
}

export async function resolveDockerSmokeEndpoint({ composeArgs, env, runCommandFn }) {
  const service = await runCommandFn({ command: 'docker',
    args: [...composeArgs, 'ps', '-q', 'harmoniarr'], env });
  const containerId = typeof service.stdout === 'string' ? service.stdout.trim() : '';
  if (service.exitCode !== 0 || !/^[a-f0-9]{64}$/u.test(containerId)) {
    throw new Error('Docker smoke endpoint requires one acknowledged service container');
  }
  const inspection = await runCommandFn({ command: 'docker',
    args: ['inspect', '--type', 'container', '--format', '{{json .NetworkSettings.Ports}}', containerId], env });
  if (inspection.exitCode !== 0) throw new Error('Docker smoke endpoint inspection failed');
  return { containerId, ...parseDockerSmokePortBindings(inspection.stdout) };
}
