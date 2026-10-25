/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { boundaryArtworkCases } from './artwork-boundary-cases.js';
import { readPinnedArtworkFile } from './artwork-pinned-file.js';

export async function loadBoundaryArtworkInput(spec, { root = process.env.HARMONIARR_BOUNDARY_FIXTURE_ROOT, signal } = {}) {
  if (!boundaryArtworkCases.includes(spec)) throw new TypeError('Use a fixed admitted artwork case');
  const image = await readPinnedArtworkFile({ root, ...spec, signal });
  return { image, artifact: { source: 'prepared-read-only', quality: spec.quality, inputBytes: image.length,
    sha256: spec.sha256, preparedSeparately: true } };
}
