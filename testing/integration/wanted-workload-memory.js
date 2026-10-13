/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
const fields = Object.freeze(['rss', 'heapUsed', 'external', 'arrayBuffers']);

export function createWantedWorkloadMemorySampler({ readMemory = () => process.memoryUsage(),
  schedule = setInterval, cancel = clearInterval } = {}) {
  let unavailable = false; let samples = 0; let bytes = 0; let finished = false; let observed = false;
  function read() {
    try {
      const value = readMemory();
      if (fields.some(field => !Number.isSafeInteger(value[field]) || value[field] < 0)) throw new Error('Invalid memory observation');
      return Object.fromEntries(fields.map(field => [field, value[field]]));
    } catch { unavailable = true; return null; }
  }
  const baseline = read(); const peak = baseline ? { ...baseline } : null;
  function sample() {
    if (finished) return;
    const value = read(); samples++;
    if (value && peak) for (const field of fields) peak[field] = Math.max(peak[field], value[field]);
  }
  const timer = schedule(sample, 5); timer.unref?.();
  return {
    observeBytes(amount) {
      if (finished || !Number.isSafeInteger(amount) || amount < 0) return;
      bytes += amount;
      if (!observed || bytes >= 1024 * 1024) { observed = true; sample(); bytes = 0; }
    },
    finish() {
      if (!finished) { cancel(timer); sample(); finished = true; }
      return Object.freeze({ baseline, peak, samples, unavailable,
        peakDelta: peak ? Object.fromEntries(fields.map(field => [field, Math.max(0, peak[field] - baseline[field])])) : null });
    },
  };
}
