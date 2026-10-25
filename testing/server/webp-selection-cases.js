/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { webpArtworkInputs } from './webp-artwork-corpus.js';
const expected = {
  'photo-earth': [150382, 'beb1f31e14dde44ba1358826c71f1680058274b392c56545158c34d2047c4c35', false],
  'painting-cypresses': [143482, 'e7dc31c072846594c0f6c997573f86bae580d7cd023dc867510755f0f891385e', false],
  'cover-type': [538, '86e91dedb1dafabe7149eaf0496f2dcc0e5b8f24f7e261e8e269989760fc606e', true],
  'cover-gradient': [5232, 'cb21eb3f16b948fc8a0e295a2da4418373107b6c9514a9582c9e465c7868bd85', true],
};
export const webpSelectionCases = Object.freeze(webpArtworkInputs.map(input => {
  const [outputBytes, outputSha256, lossless] = expected[input.id]; return Object.freeze({ input, outputBytes, outputSha256, lossless });
}));
export function selectWebpSelectionCase(id) {
  const spec = webpSelectionCases.find(row => row.input.id === id); if (!spec) throw new TypeError('Select a pinned WebP publication case'); return spec;
}
