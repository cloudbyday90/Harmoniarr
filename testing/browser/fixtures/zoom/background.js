/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

// Keep an MV3 worker available to the owned test; no page messaging or permissions.
globalThis.chrome.runtime.onInstalled.addListener(() => {});
