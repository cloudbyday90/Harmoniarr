/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { disabledWantedSeedObserver } from './wanted-seed-observer.js';

export function observeWantedSeedMedia(media, { observer = disabledWantedSeedObserver, context = 1 } = {}) {
  return { ...media,
    mediaCommand(...args) {
      const phase = args[0] === 'ffmpeg' ? 'media_generate' : 'media_inspect';
      const current = phase === 'media_inspect' ? observer.currentContext?.() ?? context : context;
      return observer.measure(phase, current, () => Reflect.apply(media.mediaCommand, media, args));
    },
    verifyTooling() { return observer.measure('tooling', context, () => media.verifyTooling()); },
  };
}
