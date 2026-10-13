/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import { lockLibraryRequestProjection } from './library-request-projection-lock-store.js';

/** Root-input statement triggers join the existing publication lock until transaction end. */
export async function lockLibraryRootAuthority({ queryable }) {
  if (typeof queryable?.query !== 'function') throw new TypeError('Root authority requires a transaction queryable');
  // Compatible with ordinary DML. PostgreSQL refuses LOCK in autocommit so a
  // borrowed pool cannot acquire a transient advisory lock and imply authority.
  await queryable.query('LOCK TABLE app_users, app_settings IN ACCESS SHARE MODE');
  await lockLibraryRequestProjection({ queryable });
}
