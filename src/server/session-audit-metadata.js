/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { isIP } from 'node:net';
export function selectSessionAuditMetadata(metadata) {
  const address = metadata?.ipAddress;
  return {
    ipAddress: typeof address === 'string' && !address.includes('%') && isIP(address) ? address : null,
    userAgent: typeof metadata?.userAgent === 'string' ? metadata.userAgent : null,
  };
}
