/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { createAdminRecoveryService } from '../../src/server/recovery/admin-recovery-service.js';

export async function armBootstrapAdminRecovery(options = {}) {
  const adminRecoveryService = createAdminRecoveryService();
  return adminRecoveryService.armBootstrapAdminRecovery(options);
}
