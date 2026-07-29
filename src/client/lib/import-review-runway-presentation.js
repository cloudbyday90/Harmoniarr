/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

const RUN_HISTORY_ROUTE_KEYS = Object.freeze([
  'applyRunId',
  'executionRunId',
  'mediaInspectionRunId',
]);

export function shouldOpenRunHistoryControls(routeState = {}) {
  return RUN_HISTORY_ROUTE_KEYS.some((key) =>
    typeof routeState?.[key] === 'string' && routeState[key].trim().length > 0,
  );
}
