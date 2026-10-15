/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { randomUUID } from 'node:crypto';
import { captureMediaInspectionPolicy } from './owned-media-inspection-policy.js';
import { assertMediaLinuxProofOwner, mediaLinuxProofId, mediaLinuxProofImage,
  mediaLinuxProofLabel, mediaLinuxProofSocket } from './media-linux-proof-policy.js';

/** CLI owns the whole runner through verified retirement, including an attached-start timeout. */
export function createMediaLinuxProofRunner({ image, root, invoke }) {
  if (!mediaLinuxProofImage.test(image) || typeof invoke !== 'function') throw new TypeError('Invalid Linux read-proof runner');
  const token = randomUUID(); let id; let trusted = false; let admitted = false; let sealed = false; let tail = Promise.resolve(); let closing;
  let capture;
  async function inspect() {
    if (!id) throw new Error('Unknown Linux read-proof owner');
    const [state] = JSON.parse((await invoke(['inspect', id])).stdout);
    assertMediaLinuxProofOwner(state, { id, image, root, token }); trusted = true; return state;
  }
  function run() {
    if (sealed || admitted) return Promise.reject(new Error('Linux read-proof admission closed'));
    admitted = true;
    const operation = (async () => {
      const policy = await (capture = captureMediaInspectionPolicy(root));
      await policy.assertRoot();
      const reply = await invoke(['create', '--network', 'none', '--read-only', '--no-healthcheck', '--cap-drop', 'ALL',
        '--security-opt', 'no-new-privileges', '--restart', 'no', '--user', '0:0', '--label', `${mediaLinuxProofLabel}=${token}`,
        '--entrypoint', 'node', '--mount', `type=bind,source=${root},target=/proof,readonly,bind-recursive=disabled`,
        '--mount', `type=bind,source=${mediaLinuxProofSocket},target=${mediaLinuxProofSocket},readonly,bind-recursive=disabled`, image, '/proof/entry.js']);
      const acknowledged = reply.stdout.trim();
      if (!mediaLinuxProofId.test(acknowledged)) throw new Error('Unknown Linux read-proof owner');
      id = acknowledged; await inspect();
      const result = await invoke(['start', '--attach', id]);
      const stopped = await inspect();
      if (stopped.State.Running !== false || stopped.State.ExitCode !== 0 || stopped.ExecIDs?.length) throw new Error('Linux read-proof did not complete');
      return result;
    })();
    tail = operation.then(() => {}, () => {}); return operation;
  }
  function close() {
    sealed = true;
    return closing ??= (async () => {
      await tail;
      if (admitted) {
        if (!trusted) throw new Error('Unknown Linux read-proof owner');
        const before = await inspect();
        if (before.State.Running) { try { await invoke(['stop', '--time', '0', id]); } catch { /* Actual stopped state owns retirement. */ } }
        const stopped = await inspect();
        if (stopped.State.Running !== false || stopped.ExecIDs?.length) throw new Error('Linux read-proof retirement unverified');
        await invoke(['rm', id]);
      }
      if (capture) await (await capture).assertRoot();
    })();
  }
  return Object.freeze({ run, close });
}
