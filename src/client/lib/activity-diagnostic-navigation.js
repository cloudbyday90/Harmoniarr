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

function defineDiagnosticGroup({ description, id, links, title }) {
  return Object.freeze({
    description,
    id,
    links: Object.freeze(links.map((link) => Object.freeze(link))),
    title,
  });
}

/**
 * The Activity diagnostics route map is intentionally static. It exposes only
 * existing, authorized destinations and keeps recovery tasks ahead of raw
 * evidence and source records.
 */
export const ACTIVITY_DIAGNOSTIC_GROUPS = Object.freeze([
  defineDiagnosticGroup({
    description: 'Start here when background work is stalled, paused, or could not add music.',
    id: 'resolve-issue',
    links: [
      { label: 'Background jobs', name: 'activity-operations' },
      { label: 'Failed library adds', name: 'activity-diagnostics-failed-library-adds' },
    ],
    title: 'Resolve an issue',
  }),
  defineDiagnosticGroup({
    description: 'Inspect matching and add evidence only when automatic progress needs investigation.',
    id: 'inspect-music',
    links: [
      { label: 'Match diagnostics', name: 'activity-diagnostics-matches' },
      { label: 'Library-add diagnostics', name: 'activity-diagnostics-library-adds' },
    ],
    title: 'Inspect music',
  }),
  defineDiagnosticGroup({
    description: 'Review saved release, request, and monitored-artist records.',
    id: 'review-records',
    links: [
      { label: 'Wanted releases', name: 'activity-wanted' },
      { label: 'Request records', name: 'activity-requests' },
      { label: 'Monitored artists', name: 'activity-monitored-artists' },
    ],
    title: 'Review records',
  }),
  defineDiagnosticGroup({
    description: 'Investigate source behavior and historical system events.',
    id: 'source-history',
    links: [
      { label: 'Source users', name: 'activity-users' },
      { label: 'Source blocklist', name: 'activity-blocklist' },
      { label: 'Ignored source users', name: 'activity-ignored' },
      { label: 'System history', name: 'activity-history' },
    ],
    title: 'Source and history',
  }),
]);
