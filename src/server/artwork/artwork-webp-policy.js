/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export const ARTWORK_WEBP_QUALITY = 90;
export const ARTWORK_WEBP_EFFORT = 4;

/** One libwebp 1.6 token-page growth unit, plus 64 KiB allocator slack.
 * Additional planning allowance, not a bound on accumulated token pages.
 */
export function webpEncoderGrowthMemoryBytes(width, height) {
  const macroblocks = Math.ceil(width / 16) * Math.ceil(height / 16);
  const tokens = Math.max(8192, Math.trunc(macroblocks * 4 * (1 + ARTWORK_WEBP_QUALITY * 5 / 100)));
  return 8 + 2 * tokens + 64 * 1024;
}
