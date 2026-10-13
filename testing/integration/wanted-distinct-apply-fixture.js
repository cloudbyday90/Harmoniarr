/*
 * Harmoniarr - Soulseek-native music library management
 * Copyright (C) 2026 Harmoniarr Contributors
 * This program is free software: licensed under GPL-3.0-or-later.
 * See LICENSE for details.
 */
import assert from 'node:assert/strict';
import { createImportCandidateApplyOperationService } from '../../src/server/import-candidates/import-candidate-apply-operation-service.js';
import { runTrackDeliveryApply } from './operator-track-delivery-recovery-fixture.js';
import { disabledWantedSeedObserver } from './wanted-seed-observer.js';

/** Keep the canonical worker's actual preview; never supply a cached plan to it. */
export async function applyWantedDistinctFixture(input, { context = 1, seedObserver = disabledWantedSeedObserver,
  seedPreviewMode = 'worker' } = {}) {
  if (!['worker', 'separate'].includes(seedPreviewMode)) throw new TypeError('Invalid seed preview mode');
  let planned; let previews = 0;
  if (seedPreviewMode === 'separate') planned = await seedObserver.measure('delivery_preview', context,
    () => input.preview.previewImportCandidateApply({ importCandidateId: input.candidateId }));
  const applied = await seedObserver.measure('delivery_apply', context, () => runTrackDeliveryApply(input,
    createImportCandidateApplyOperationService({ mediaInspectionService: input.inspection }), {
      onPreview: value => { previews++; if (seedPreviewMode === 'worker') planned = value; },
    }));
  assert.equal(applied.item.itemStatus, 'applied'); assert.equal(previews, 1);
  assert.ok(Array.isArray(planned?.files));
  return { planned, applied };
}
