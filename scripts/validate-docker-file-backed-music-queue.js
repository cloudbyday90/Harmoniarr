/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 *
 * This program is free software: licensed under GPL-3.0
 * See LICENSE file for details.
 */

import { runDirectScriptTask } from './script-runtime.js';
import {
  resolveDockerFileBackedMusicQueueValidationInputs,
  runDockerFileBackedMusicQueueValidation,
} from './docker-file-backed-music-queue-validation.js';

export async function runDockerFileBackedMusicQueueValidationFromEnvironment(env = process.env, {
  args = process.argv.slice(2),
} = {}) {
  return runDockerFileBackedMusicQueueValidation(
    resolveDockerFileBackedMusicQueueValidationInputs({ args, env }),
  );
}

await runDirectScriptTask(import.meta, {
  prefix: 'harmoniarr-validate-docker-file-backed-music-queue',
  renderSuccessMessage: (result) => `Verified real media quality and scoped Music Queue recovery: ${result.authentic.candidateId} was added; ${result.transcoded.candidateId} and ${result.collision.candidateId} remained blocked; ${result.recovered.candidateId} resumed alone.`,
  run: () => runDockerFileBackedMusicQueueValidationFromEnvironment(),
});
