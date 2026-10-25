/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { selectBoundaryArtworkCase } from './artwork-boundary-cases.js';

export const webpEffortInput = selectBoundaryArtworkCase('rgb8-webp-7120-token-refusal');
export const webpEffortCases = Object.freeze(['full', 'center-1024'].flatMap(scope => [2, 4].map(effort => Object.freeze({
  id: `${scope}-effort-${effort}`, scope, effort, quality: 90,
  width: scope === 'full' ? 7120 : 1024, height: scope === 'full' ? 7120 : 1024,
  crop: scope === 'full' ? null : Object.freeze({ left: 3048, top: 3048, width: 1024, height: 1024 }),
}))));

export function selectWebpEffortCase(effort, scope) {
  const spec = webpEffortCases.find(row => row.effort === effort && row.scope === scope);
  if (!spec) throw new TypeError('Select fixed WebP effort 2/4 and full/center-1024 scope');
  return spec;
}
