/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { webpArtworkInputs } from './webp-artwork-corpus.js';
import { selectWebpEffortCase } from './webp-effort-cases.js';

export const webpLosslessCases = Object.freeze(webpArtworkInputs.map(input => Object.freeze({
  id: `${input.id}-lossless-effort-4`, scope: input.id, mode: 'lossless', lossless: true, effort: 4, quality: 90,
  width: input.width, height: input.height, crop: null, input,
})));
export function selectWebpRewriteCase(effort, scope, mode = 'lossy') {
  if (mode === 'lossy') return selectWebpEffortCase(effort, scope);
  const spec = mode === 'lossless' && webpLosslessCases.find(row => row.effort === effort && row.scope === scope);
  if (!spec) throw new TypeError('Select an allowlisted rewrite mode, effort and scope'); return spec;
}
export const webpLosslessSchedule = Object.freeze(webpArtworkInputs.flatMap((input, index) => [1, 2, 3].flatMap(repetition =>
  ((index + repetition) % 2 ? ['lossy', 'lossless'] : ['lossless', 'lossy']).map(mode => Object.freeze({ scope: input.id, effort: 4, mode, repetition,
    runId: `${input.id}-${mode}-r${repetition}` })))));
