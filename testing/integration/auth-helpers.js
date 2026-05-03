/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

export async function bootstrapAdminSession(client, overrides = {}) {
  return client.requestJson('/api/v1/bootstrap/admin', {
    json: {
      password: 'IntegrationPass123!',
      username: 'admin',
      ...overrides,
    },
    method: 'POST',
  });
}
