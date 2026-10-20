/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */

import { projectExternalRequestSearchDiagnostics } from '../../shared/external-request-search-diagnostics.js';

const quantity = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

export function buildExternalRequestSearchDiagnostics(value) {
  const data = projectExternalRequestSearchDiagnostics(value);
  if (!data) return null;
  const details = []; const links = [];
  if (data.ignoredUserResponseCount > 0) {
    details.push(`${quantity(data.ignoredUserResponseCount, 'response')} excluded because the source is ignored.`);
    links.push({ label: 'Review ignored sources', to: { name: 'activity-ignored' } });
  }
  if (data.blacklistedFileCount > 0) {
    details.push(`${quantity(data.blacklistedFileCount, 'file')} excluded by title terms. Review the intentional title exclusions used for this search.`);
  }
  if (data.missingUsernameResponseCount > 0) {
    details.push(`${quantity(data.missingUsernameResponseCount, 'response')} missing uploader identity; these cannot become candidates.`);
  }
  if (data.malformedFileCount > 0) {
    details.push(`${quantity(data.malformedFileCount, 'file')} could not be read as a valid candidate file.`);
  }
  if (data.responseFileCount === 0) details.push('The provider responses contained no files.');
  if (details.length === 0) details.push('The available evidence does not identify why no candidate folders were produced.');
  if (data.missingUsernameResponseCount > 0 || data.malformedFileCount > 0 || data.responseFileCount === 0
    || (data.ignoredUserResponseCount === 0 && data.blacklistedFileCount === 0)) {
    links.push({ label: 'Review provider connection', to: { name: 'settings-connections' } });
  }
  return { summary: `${quantity(data.responseCount, 'provider response')} included ${quantity(data.responseFileCount, 'file')}; no usable candidates were created.`,
    details, links };
}
