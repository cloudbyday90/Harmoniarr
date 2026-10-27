/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export function toSessionUser(row) {
  return { id: row.id, username: row.username, role: row.role, mustChangePassword: row.must_change_password, lastLoginAt: row.last_login_at };
}
