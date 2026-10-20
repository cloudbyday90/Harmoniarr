/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { projectSlskdSearchDiagnostics } from '../../shared/slskd-search-diagnostics.js';

const causes = [
  ['ignoredUserResponseCount', 'Ignored-source responses'],
  ['blacklistedFileCount', 'Files excluded by title'],
  ['missingUsernameResponseCount', 'Responses missing identity'],
  ['malformedFileCount', 'Malformed files'],
];

export function buildSlskdSearchDiagnosticsPresentation(value) {
  const data = projectSlskdSearchDiagnostics(value);
  if (!data) return null;
  const details = [{ label: 'Provider responses', value: String(data.responseCount) },
    { label: 'Provider files', value: String(data.responseFileCount) }];
  for (const [field, label] of causes) if (data[field] > 0) details.push({ label, value: String(data[field]) });
  const message = data.responseCount === 0 ? 'The last recorded search received no provider responses.'
    : data.ignoredUserResponseCount === data.responseCount ? 'Provider responses came from ignored sources.'
      : data.responseFileCount > 0 && data.blacklistedFileCount === data.responseFileCount
        ? 'Every recorded provider file matched a blocked title term.'
        : data.responseFileCount === 0 ? 'Provider responses contained no files.'
          : 'Provider responses produced no usable candidates. Review the separate cause counts.';
  return { message, details };
}
