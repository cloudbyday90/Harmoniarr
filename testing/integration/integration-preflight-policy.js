/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */

export const integrationImageId = /^sha256:[a-f0-9]{64}$/u;
export const integrationProbeId = /^[a-f0-9]{64}$/u;
export const integrationProbeLabel = 'io.harmoniarr.fixture.capability-owner';
export const integrationPreflightError = () => Object.assign(new Error('Integration prerequisite refused'), {
  code: 'fixture_integration_prerequisite_refused',
});
const command = (binary, args, version) => Object.freeze({ binary, args: Object.freeze(args), version });
export const integrationProbeCommands = Object.freeze({
  postgres: command('postgres', ['--version'], /^postgres \(PostgreSQL\) (18(?:\.\d+)+)(?:\s|$)/u),
  ffmpeg: command('ffmpeg', ['-version'], /^ffmpeg version ([A-Za-z0-9.+_-]{1,80})(?:\s|$)/u),
  ffprobe: command('ffprobe', ['-version'], /^ffprobe version ([A-Za-z0-9.+_-]{1,80})(?:\s|$)/u),
  node: command('node', ['--version'], /^v(24\.(\d+)\.\d+)\s*$/u),
  docker: command('docker', ['--version'], /^Docker version (\d+\.\d+\.\d+)(?:[\s,+-]|$)/u),
});

export function integrationProbeVersion(tool, stdout) {
  const match = typeof stdout === 'string' && stdout.length <= 64 * 1024
    && integrationProbeCommands[tool]?.version.exec(stdout);
  if (!match || (tool === 'node' && Number(match[2]) < 15)) throw integrationPreflightError();
  return match[1];
}

/** A complete acknowledged identity plus current configuration owns all later actions. */
export function assertIntegrationProbeOwner(state, { id, image, tool, token }) {
  const spec = integrationProbeCommands[tool]; const host = state?.HostConfig;
  const mounts = state?.Mounts;
  const pgMount = tool === 'postgres';
  if (state?.Id !== id || state.Image !== image || state.Config?.Labels?.[integrationProbeLabel] !== token
    || JSON.stringify(state.Config?.Entrypoint) !== JSON.stringify([spec.binary])
    || JSON.stringify(state.Config?.Cmd) !== JSON.stringify(spec.args)
    || JSON.stringify(state.Config?.Healthcheck?.Test) !== '["NONE"]' || state.Config?.User !== '65534:65534'
    || host?.NetworkMode !== 'none' || host.ReadonlyRootfs !== true || host.Privileged !== false
    || host.RestartPolicy?.Name !== 'no' || host.AutoRemove !== false || host.CapAdd?.length
    || JSON.stringify(host.CapDrop) !== '["ALL"]' || JSON.stringify(host.SecurityOpt) !== '["no-new-privileges"]'
    || host.Binds?.length || (host.Tmpfs && Object.keys(host.Tmpfs).length)
    || !Array.isArray(host.Mounts ?? []) || (host.Mounts ?? []).length !== (pgMount ? 1 : 0)
    || !Array.isArray(mounts) || mounts.length !== (pgMount ? 1 : 0)
    || (state.ExecIDs !== null && !Array.isArray(state.ExecIDs))) throw integrationPreflightError();
  if (pgMount && (host.Mounts[0].Type !== 'tmpfs' || host.Mounts[0].Target !== '/var/lib/postgresql'
    || host.Mounts[0].TmpfsOptions?.SizeBytes !== 1048576 || mounts[0].Type !== 'tmpfs'
    || mounts[0].Destination !== '/var/lib/postgresql')) throw integrationPreflightError();
  if (typeof state.State?.Running !== 'boolean') throw integrationPreflightError();
}
