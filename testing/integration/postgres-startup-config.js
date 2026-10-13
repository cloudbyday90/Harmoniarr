/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
export const supportsPostgresStartupImage = image => typeof image === 'string'
  && /^postgres:18(?:\.\d+)?-alpine(?:@sha256:[a-f0-9]{64})?$/u.test(image);

export const postgresStartupCommand = Object.freeze(['postgres',
  '-c', 'logging_collector=on', '-c', 'log_destination=stderr,jsonlog',
  '-c', 'log_connections=receipt,authentication,authorization,setup_durations',
  '-c', 'log_directory=log', '-c', 'log_filename=harmoniarr-startup.log',
  '-c', 'log_rotation_age=0', '-c', 'log_rotation_size=0',
  '-c', 'log_error_verbosity=verbose', '-c', 'lc_messages=C']);
