/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * Licensed under GPL-3.0-or-later. See LICENSE.
 */
export const readinessFailureLimit = 16;
export const readinessStageLabels = Object.freeze({
  package_metadata: 'Package metadata', settings: 'Settings', migration_status: 'Migration status', database_query: 'Database query',
  dependencies: 'Dependencies', heartbeats: 'Background job status', active_jobs: 'Active job count', provider_status: 'Provider status',
  overview_projection: 'Overview preparation', artwork_summary: 'Artwork summary', activity_feed: 'Activity feed',
  runtime_projection: 'Runtime summary', response_projection: 'Health response', complete: 'Complete',
});
export const readinessStages = Object.freeze(Object.keys(readinessStageLabels));
export const readinessCategoryLabels = Object.freeze({ unknown: 'Unclassified failure', connection_failure: 'Connection failure',
  database_connection: 'Database connection failure', query_cancelled: 'Query cancelled', database_lock: 'Database lock failure',
  database_query: 'Database query failure', permission_denied: 'Permission denied', file_missing: 'File missing', resource_limit: 'Resource limit' });
export const readinessCodeCategories = Object.freeze({
  ECONNREFUSED: 'connection_failure', ECONNRESET: 'connection_failure', ENOTFOUND: 'connection_failure', ETIMEDOUT: 'connection_failure',
  '57P01': 'database_connection', '57P02': 'database_connection', '57P03': 'database_connection', '08003': 'database_connection', '08006': 'database_connection',
  '57014': 'query_cancelled', '55P03': 'database_lock', '40P01': 'database_lock', '42P01': 'database_query', '42501': 'database_query',
  '42703': 'database_query', '23505': 'database_query', '23503': 'database_query', '23502': 'database_query', XX000: 'database_query',
  EACCES: 'permission_denied', EPERM: 'permission_denied', ENOENT: 'file_missing', EMFILE: 'resource_limit', ENFILE: 'resource_limit',
  ENOSPC: 'resource_limit', ENOMEM: 'resource_limit', '53200': 'resource_limit', '53300': 'resource_limit', '53400': 'resource_limit',
});
