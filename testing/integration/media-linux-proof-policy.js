/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
export const mediaLinuxProofLabel = 'io.harmoniarr.fixture.linux-read-proof';
export const mediaLinuxProofSocket = '/var/run/docker.sock';
export const mediaLinuxProofId = /^[a-f0-9]{64}$/u;
export const mediaLinuxProofImage = /^sha256:[a-f0-9]{64}$/u;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** A separate privileged test runner; never relax the media owner's no-socket policy. */
export function assertMediaLinuxProofOwner(state, { id, image, root, token }) {
  const mount = state?.HostConfig?.Mounts; const effective = state?.Mounts;
  if (state?.Id !== id || state.Image !== image || state.Config?.Labels?.[mediaLinuxProofLabel] !== token
    || !same(state.Config.Entrypoint, ['node']) || !same(state.Config.Cmd, ['/proof/entry.js'])
    || !same(state.Config.Healthcheck?.Test, ['NONE']) || state.Config.User !== '0:0'
    || state.HostConfig?.NetworkMode !== 'none' || state.HostConfig.ReadonlyRootfs !== true
    || state.HostConfig.Privileged !== false || state.HostConfig.RestartPolicy?.Name !== 'no'
    || !same(state.HostConfig.CapDrop, ['ALL']) || !same(state.HostConfig.SecurityOpt, ['no-new-privileges'])
    || !Array.isArray(mount) || mount.length !== 2 || !Array.isArray(effective) || effective.length !== 2
    || typeof state.State?.Running !== 'boolean' || (state.ExecIDs !== null && !Array.isArray(state.ExecIDs))) throw new Error('Linux read-proof owner changed');
  for (const [source, target] of [[root, '/proof'], [mediaLinuxProofSocket, mediaLinuxProofSocket]]) {
    const declared = mount.filter(row => row.Target === target); const actual = effective.filter(row => row.Destination === target);
    if (declared.length !== 1 || declared[0].Source !== source || declared[0].Type !== 'bind' || declared[0].ReadOnly !== true
      || declared[0].BindOptions?.NonRecursive !== true || actual.length !== 1 || actual[0].RW !== false) throw new Error('Linux read-proof mount changed');
  }
}
