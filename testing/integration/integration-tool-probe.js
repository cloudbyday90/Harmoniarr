/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { randomUUID } from 'node:crypto';
import { withWorkerTaskCleanup } from '../../src/server/worker-task-cleanup.js';
import { assertIntegrationProbeOwner, integrationImageId, integrationPreflightError,
  integrationProbeCommands, integrationProbeId, integrationProbeLabel, integrationProbeVersion } from './integration-preflight-policy.js';

/** One fixed version command; CLI cancellation is followed by verified remote retirement. */
export async function probeIntegrationTool({ image, tool, signal, invoke }) {
  if (!integrationImageId.test(image) || !Object.hasOwn(integrationProbeCommands, tool)
    || typeof invoke !== 'function') throw integrationPreflightError();
  const spec = integrationProbeCommands[tool]; const token = randomUUID(); let id; let trusted = false;
  const checkCancellation = () => { if (signal?.aborted) throw signal.reason; };
  async function inspect() {
    const rows = JSON.parse((await invoke(['inspect', id])).stdout);
    if (!Array.isArray(rows) || rows.length !== 1) throw integrationPreflightError();
    assertIntegrationProbeOwner(rows[0], { id, image, tool, token }); trusted = true; return rows[0];
  }
  checkCancellation();
  const version = await withWorkerTaskCleanup(async () => {
    // Do not abort create: wait for its bounded acknowledgement before cancellation/cleanup.
    const reply = await invoke(['create', '--pull', 'never', '--network', 'none', '--read-only', '--no-healthcheck', '--cap-drop', 'ALL',
      '--security-opt', 'no-new-privileges', '--restart', 'no', '--user', '65534:65534',
      '--label', `${integrationProbeLabel}=${token}`, '--entrypoint', spec.binary,
      ...(tool === 'postgres' ? ['--mount', 'type=tmpfs,destination=/var/lib/postgresql,tmpfs-size=1048576'] : []), image, ...spec.args]);
    const acknowledged = reply.stdout.trim();
    if (!integrationProbeId.test(acknowledged)) throw integrationPreflightError();
    id = acknowledged; const initial = await inspect();
    if (initial.State.Running || initial.ExecIDs?.length) throw integrationPreflightError();
    checkCancellation(); let result;
    try { result = await invoke(['start', '--attach', id], { ...(signal ? { signal } : {}) }); }
    catch (error) { checkCancellation(); throw error; }
    checkCancellation(); const stopped = await inspect();
    if (stopped.State.Running || stopped.State.ExitCode !== 0 || stopped.ExecIDs?.length) throw integrationPreflightError();
    return integrationProbeVersion(tool, result.stdout);
  }, async () => {
    // A failed/uncertain create or changed owner never authorizes inferred cleanup.
    if (!trusted) throw integrationPreflightError();
    const before = await inspect();
    if (before.State.Running) {
      try { await invoke(['stop', '--time', '0', id]); } catch { /* Current stopped state owns retirement. */ }
    }
    const stopped = await inspect();
    if (stopped.State.Running || stopped.ExecIDs?.length) throw integrationPreflightError();
    await invoke(['rm', id]);
  });
  checkCancellation(); return version;
}
