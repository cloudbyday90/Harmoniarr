/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { mediaExecutorError } from './owned-media-inspection-policy.js';
import { disabledMediaTransportObserver } from './media-transport-phase-observer.js';
import { createMediaDockerInspectionReader } from './media-docker-inspection-reader.js';

const executeFile = promisify(execFile);
const label = 'io.harmoniarr.fixture.media-owner';
const idPattern = /^[a-f0-9]{64}$/u;
const imagePattern = /^sha256:[a-f0-9]{64}$/u;

/** Bounded CLI transport: ownership comes only from an acknowledged complete ID. */
export function createOwnedMediaDockerTransport({ image, root, executeFileFn = executeFile, commandTimeoutMs = 30_000,
  transportObserver = disabledMediaTransportObserver, inspectionReadMode = 'cli',
  createInspectionReader = createMediaDockerInspectionReader } = {}) {
  if (!image || typeof executeFileFn !== 'function' || !Number.isSafeInteger(commandTimeoutMs)
    || commandTimeoutMs < 1 || commandTimeoutMs > 30_000 || typeof transportObserver?.measure !== 'function'
    || !['cli', 'api'].includes(inspectionReadMode) || typeof createInspectionReader !== 'function') throw new TypeError('Invalid media transport');
  const token = randomUUID(); let id; let imageId; let trusted = false; let reader; let creationAdmitted = false;
  let env = inspectionReadMode === 'api' ? Object.freeze({ ...process.env }) : undefined;
  const invoke = (phase, args, options = {}) => transportObserver.measure(phase, () => executeFileFn('docker', args, {
    timeout: 30_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true, shell: false, ...(env ? { env } : {}), ...options,
  }));
  async function inspect(phase) {
    if (!id) throw mediaExecutorError('fixture_media_owner_unknown');
    // Both readers pass through exactly the same current ownership/configuration policy.
    const state = reader ? await transportObserver.measure(phase, () => reader.inspect(id))
      : JSON.parse((await invoke(phase, ['inspect', id])).stdout)[0];
    const mount = state?.HostConfig?.Mounts;
    if (state?.Id !== id || state.Image !== imageId || state.Config?.Labels?.[label] !== token
      || JSON.stringify(state.Config?.Entrypoint) !== '["sleep"]' || JSON.stringify(state.Config?.Cmd) !== '["infinity"]'
      || JSON.stringify(state.Config?.Healthcheck?.Test) !== '["NONE"]'
      || state.HostConfig?.NetworkMode !== 'none' || state.HostConfig?.ReadonlyRootfs !== true
      || state.HostConfig?.RestartPolicy?.Name !== 'no' || state.HostConfig?.Privileged !== false
      || !state.HostConfig?.CapDrop?.includes('ALL') || !state.HostConfig?.SecurityOpt?.includes('no-new-privileges')
      || !Array.isArray(mount) || mount.length !== 1 || mount[0].Type !== 'bind' || mount[0].Source !== root
      || mount[0].Target !== '/fixtures' || mount[0].ReadOnly !== true || mount[0].BindOptions?.NonRecursive !== true
      || !Array.isArray(state.Mounts) || state.Mounts.length !== 1 || state.Mounts[0].Destination !== '/fixtures'
      || state.Mounts[0].RW !== false || (state.ExecIDs !== null && !Array.isArray(state.ExecIDs))) throw mediaExecutorError('fixture_media_owner_changed');
    trusted = true;
    return state;
  }
  return Object.freeze({
    async start() {
      if (inspectionReadMode === 'api') reader = await createInspectionReader({ invoke, env, transportObserver,
        setEnvironment: pinned => { env = pinned; } });
      imageId = (await invoke('image_inspect', ['image', 'inspect', image, '--format', '{{.Id}}'])).stdout.trim();
      if (!imagePattern.test(imageId)) throw mediaExecutorError('fixture_media_image_refused');
      creationAdmitted = true;
      const reply = await invoke('owner_create', ['create', '--network', 'none', '--read-only', '--no-healthcheck', '--cap-drop', 'ALL',
        '--security-opt', 'no-new-privileges', '--restart', 'no', '--label', `${label}=${token}`,
        '--entrypoint', 'sleep', '--mount', `type=bind,source=${root},target=/fixtures,readonly,bind-recursive=disabled`, imageId, 'infinity']);
      const acknowledged = reply.stdout.trim();
      if (!idPattern.test(acknowledged)) throw mediaExecutorError('fixture_media_owner_unknown');
      id = acknowledged;
      await inspect('start_inspect');
      await invoke('owner_start', ['start', id]);
      if ((await inspect('start_inspect')).State?.Running !== true) throw mediaExecutorError('fixture_media_not_running');
    },
    async run(args, signal) {
      const before = await inspect('command_inspect_before');
      if (before.State?.Running !== true || before.ExecIDs?.length) throw mediaExecutorError('fixture_media_not_quiescent');
      const result = await invoke('command_exec', ['exec', id, 'ffprobe', ...args], { timeout: commandTimeoutMs, ...(signal ? { signal } : {}) });
      const after = await inspect('command_inspect_after');
      if (after.State?.Running !== true || after.ExecIDs?.length) throw mediaExecutorError('fixture_media_not_quiescent');
      return result;
    },
    async retire() {
      if (inspectionReadMode === 'api' && !creationAdmitted) return;
      // Never target an inferred name or an ID whose original configuration was not validated.
      if (!trusted) throw mediaExecutorError('fixture_media_owner_unknown');
      const before = await inspect('retire_inspect_before');
      if (before.State?.Running) {
        let stopError; let failed = false;
        try { await invoke('owner_stop', ['stop', '--time', '0', id]); } catch (error) { failed = true; stopError = error; }
        const after = await inspect('retire_inspect_after');
        if (after.State?.Running !== false) throw failed ? stopError : mediaExecutorError('fixture_media_not_quiescent');
      } else if (before.State?.Running !== false) throw mediaExecutorError('fixture_media_not_quiescent');
    },
    async remove() {
      if (inspectionReadMode === 'api' && !creationAdmitted) return;
      if (!trusted || (await inspect('remove_inspect_before')).State?.Running !== false) throw mediaExecutorError('fixture_media_not_quiescent');
      await invoke('owner_remove', ['rm', id]);
    },
    closeReader: () => reader?.close(),
  });
}
