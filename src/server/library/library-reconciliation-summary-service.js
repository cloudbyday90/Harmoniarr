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

import { createLibraryReconciliationSummaryStore } from './library-reconciliation-summary-store.js';

function buildSummary({ fileCounts, releaseCounts }) {
  if (fileCounts.observed === 0) {
    return {
      message: 'No observed library files have been reconciled yet.',
      status: 'empty',
    };
  }

  if (fileCounts.ambiguous > 0 || fileCounts.unmatched > 0 || releaseCounts.duplicate > 0) {
    const reviewRequiredCount = fileCounts.ambiguous + fileCounts.unmatched + releaseCounts.duplicate;
    return {
      message: `${reviewRequiredCount} reconciliation item${reviewRequiredCount === 1 ? '' : 's'} still need review.`,
      status: 'review_required',
    };
  }

  if (releaseCounts.partial > 0) {
    return {
      message: `${releaseCounts.partial} release${releaseCounts.partial === 1 ? '' : 's'} are partially satisfied by the current library.`,
      status: 'partial',
    };
  }

  if (releaseCounts.complete > 0) {
    return {
      message: `${releaseCounts.complete} release${releaseCounts.complete === 1 ? '' : 's'} are fully satisfied by current library matches.`,
      status: 'complete',
    };
  }

  return {
    message: 'Library files have been reconciled, but no release-level coverage is available yet.',
    status: 'incomplete',
  };
}

export function createLibraryReconciliationSummaryService({
  libraryReconciliationSummaryStore = createLibraryReconciliationSummaryStore(),
} = {}) {
  async function buildLibraryReconciliationSummary() {
    const checkedAt = new Date().toISOString();
    const snapshot = await libraryReconciliationSummaryStore.getLibraryReconciliationSnapshot();

    return {
      checkedAt,
      fileCounts: snapshot.fileCounts,
      lastReconciledAt: snapshot.lastReconciledAt,
      releaseCounts: snapshot.releaseCounts,
      summary: buildSummary(snapshot),
    };
  }

  return {
    buildLibraryReconciliationSummary,
  };
}