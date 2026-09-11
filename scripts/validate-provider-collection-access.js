/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseStrictScriptOptions } from './script-input-resolution.js';
import { getRequiredSecretFileInput } from './secret-input.js';
import { runDirectScriptTask } from './script-runtime.js';
import { collectProviderCollectionAccessEvidence, normalizeProviderAccessBaseUrl } from './provider-collection-access-session.js';

export const providerCollectionAccessHelp = 'Usage: npm run validate:provider-collection-access -- --live --base-url <application-origin> --username <admin> --password-file <protected-file> --source-url <collection-url> --evidence-path <new-json-file>\nThis reads at most two collection pages using saved provider credentials. Strict acceptance requires multiple pages and complete traversal. No acquisition work is created.';

export function parseProviderCollectionAccessOptions(args = process.argv.slice(2)) {
  let values;
  try {
    ({ values } = parseStrictScriptOptions({
      live: { type: 'boolean' }, help: { type: 'boolean' },
      'base-url': { type: 'string' }, username: { type: 'string' },
      'password-file': { type: 'string' }, 'source-url': { type: 'string' }, 'evidence-path': { type: 'string' },
    }, { args }));
  } catch { throw new Error('Invalid provider collection access options; use --help for supported inputs'); }
  if (values.help) return { help: true };
  if (values.live !== true) throw new Error('Explicit --live is required before reading credentials or contacting the application');
  for (const key of ['base-url', 'username', 'password-file', 'source-url', 'evidence-path']) {
    if (typeof values[key] !== 'string' || !values[key].trim()) throw new Error(`--${key} is required`);
  }
  return { ...values, 'base-url': normalizeProviderAccessBaseUrl(values['base-url']) };
}

export async function runProviderCollectionAccessValidation({ args = process.argv.slice(2), fetchFn = fetch, getNow } = {}) {
  const values = parseProviderCollectionAccessOptions(args);
  if (values.help) return { help: true };
  const password = await getRequiredSecretFileInput({
    env: {}, values, fileOptionName: 'password-file', fileEnvName: 'Protected administrator password file',
  });
  const { evidence, sessionClosed } = await collectProviderCollectionAccessEvidence({
    baseUrl: values['base-url'], username: values.username, password, sourceUrl: values['source-url'], fetchFn, getNow,
  });
  try {
    await mkdir(dirname(values['evidence-path']), { recursive: true });
    await writeFile(values['evidence-path'], `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  } catch { throw new Error('Evidence could not be written; select a new writable output file'); }
  if (!sessionClosed) throw new Error('Safe evidence saved; the diagnostic session could not be closed. Sign out of the application');
  if (!evidence.acceptancePassed) throw new Error('Safe evidence saved; strict multi-page collection acceptance remains incomplete');
  return evidence;
}

await runDirectScriptTask(import.meta, {
  prefix: 'provider-collection-access',
  run: () => runProviderCollectionAccessValidation(),
  renderSuccessMessage: (result) => result.help ? providerCollectionAccessHelp : 'Safe evidence saved; strict multi-page collection acceptance passed',
});
