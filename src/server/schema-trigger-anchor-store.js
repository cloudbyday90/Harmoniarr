/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
const normalize = value => String(value ?? '').replace(/\s+/g, ' ').trim();

/** Include function content and enabled state: a named but disabled trigger is no guard. */
export async function inspectSchemaTriggerAnchors({ anchors, client }) {
  const entries = [];
  for (const anchor of anchors) {
    const row = (await client.query(`SELECT trigger.tgenabled AS enabled,
      pg_get_triggerdef(trigger.oid, true) AS definition,
      pg_get_functiondef(trigger.tgfoid) AS function_definition
      FROM pg_trigger trigger JOIN pg_class relation ON relation.oid=trigger.tgrelid
      JOIN pg_namespace namespace ON namespace.oid=relation.relnamespace
      WHERE namespace.nspname=$1 AND relation.relname=$2 AND trigger.tgname=$3
        AND NOT trigger.tgisinternal`, ['public', anchor.table, anchor.trigger])).rows[0];
    entries.push([`trigger.${anchor.table}.${anchor.trigger}`, { anchor,
      actual: row?.enabled === 'O' ? { enabled: row.enabled, definition: normalize(row.definition),
        // Function bodies contain string literals: collapsing their whitespace
        // could hide a changed lock key or other decision-relevant content.
        functionDefinition: String(row.function_definition ?? '').trim() } : null }]);
  }
  return Object.fromEntries(entries);
}
