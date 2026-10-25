/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { projectArtworkAdmissionSnapshot } from '../shared/artwork-admission-diagnostics.js';
const memoryFields = ['rssBytes', 'heapUsedBytes', 'externalBytes', 'arrayBuffersBytes'];
const timestamp = value => typeof value === 'string' && value.length <= 32 && Number.isFinite(Date.parse(value)) ? value : null;

/** Cached process measurements and live logical accounting have separate clocks. */
export function buildSystemRuntimeDiagnostics({ artworkIngestionService, runtimeResourceMonitor, nowFn = () => new Date() } = {}) {
  let artworkAdmission = null; let processMemory = null;
  try {
    const snapshot = projectArtworkAdmissionSnapshot(artworkIngestionService?.getAdmissionSnapshot?.());
    if (snapshot) artworkAdmission = { ...snapshot, capturedAt: nowFn().toISOString() };
  } catch { /* An unavailable diagnostic must not manufacture an idle gate. */ }
  try {
    const sample = runtimeResourceMonitor?.getRuntimeState?.()?.latestSample;
    if (timestamp(sample?.capturedAt) && sample?.memory) processMemory = { capturedAt: sample.capturedAt,
      ...Object.fromEntries(memoryFields.map(key => [key, Number.isSafeInteger(sample.memory[key]) && sample.memory[key] >= 0 ? sample.memory[key] : null])) };
  } catch { /* Preserve unavailable process measurements independently. */ }
  return { artworkAdmission, processMemory };
}
