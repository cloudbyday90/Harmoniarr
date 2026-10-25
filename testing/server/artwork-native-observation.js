/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import sharp from 'sharp';

// Test-only preload: the production worker still owns limits, settings and output.
const timer = setInterval(() => {
  if (sharp.counters().process > 0) {
    clearInterval(timer);
    process.stderr.write('HX_WEBP_NATIVE_ACTIVE\n');
  }
}, 1);
timer.unref();
