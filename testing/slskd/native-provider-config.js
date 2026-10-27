/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
import { renderManagedSlskdConfig } from '../../docker/managed-slskd-config.js';

/** Add a separate observer only to owned, internal-network qualification fixtures. */
export function renderNativeProviderConfig({ secrets, mode, observerApiKey }) {
  let config = renderManagedSlskdConfig(secrets);
  if (observerApiKey !== undefined) {
    if (!['partial', 'resume', 'refusal', 'audio'].includes(mode) || !/^[a-f0-9]{48}$/u.test(observerApiKey)) throw new TypeError('Invalid qualification observer scope');
    const marker = '    api_keys:\n';
    if (config.split(marker).length !== 2) throw new Error('Unrecognized native credential layout');
    config = config.replace(marker, marker + `      fixture_observer:\n        key: ${JSON.stringify(observerApiKey)}\n        role: administrator\n        cidr: "0.0.0.0/0,::/0"\n`);
  }
  const inactivity = mode === 'cancellation' ? '  connection:\n    timeout:\n      inactivity: 240000\n' : '';
  const retries = mode === 'partial' ? 'transfers:\n  download:\n    retry:\n      attempts: 1\n' : '';
  return config + inactivity + retries;
}
