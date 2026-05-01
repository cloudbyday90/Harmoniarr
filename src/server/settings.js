/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { getPool } from './database.js';
import { getDefaultSettings, normalizeSettingsPatch } from './validators/settings-validator.js';

export async function loadSettings() {
  const pool = getPool();
  const result = await pool.query(
    'SELECT namespace, setting_key, setting_value FROM app_settings ORDER BY namespace ASC, setting_key ASC',
  );

  const settings = getDefaultSettings();
  for (const row of result.rows) {
    if (settings[row.namespace] && row.setting_key in settings[row.namespace]) {
      settings[row.namespace][row.setting_key] = row.setting_value;
    }
  }

  return settings;
}

export async function persistSettings(updates, updatedByUserId = null) {
  const pool = getPool();

  for (const update of updates) {
    await pool.query(
      `
        INSERT INTO app_settings (
          namespace,
          setting_key,
          setting_value,
          updated_by_user_id,
          updated_at
        )
        VALUES ($1, $2, $3::jsonb, $4, NOW())
        ON CONFLICT (namespace, setting_key) DO UPDATE
        SET setting_value = EXCLUDED.setting_value,
            updated_by_user_id = EXCLUDED.updated_by_user_id,
            updated_at = NOW()
      `,
      [update.namespace, update.settingKey, JSON.stringify(update.value), updatedByUserId],
    );
  }

  return loadSettings();
}
