import assert from 'node:assert/strict';
import test from 'node:test';
import { getActivityEventDetail, getActivityEventIcon, getActivityEventLabel, normalizeActivityEvent } from '../../src/client/lib/activity-event-normalization.js';
import { buildActivityEventLinkTarget } from '../../src/client/lib/activity-event-link-targets.js';
import { filterActivityTimelineEvents, getActivityTimelineEventPresentation } from '../../src/client/lib/activity-timeline-presentation.js';

test('request lifecycle events use generic labels and safe scoped navigation despite private input', () => {
  for (const [eventType, label] of [['request_cancelled', 'Music request cancelled'], ['request_reassigned', 'Music request reassigned']]) {
    const raw = { eventType, id: 'event', entityId: 'request', actorUserId: 'actor', entityType: 'media_request',
      entityTitle: 'private title', entityArtist: 'private artist', extraPayload: { reason: 'private reason', requestedForUserId: 'private target' } };
    const normalized = normalizeActivityEvent(raw);
    assert.equal(normalized.entityTitle, null);
    assert.equal(normalized.entityArtist, null);
    assert.equal(normalized.extraPayload, null);
    assert.equal(getActivityEventLabel(raw), label);
    assert.equal(getActivityEventDetail(raw), '');
    assert.equal(getActivityEventIcon(eventType), 'music-request');
    assert.deepEqual(buildActivityEventLinkTarget(raw), { label: 'Open requests', to: { name: 'request-music' } });
    assert.equal(getActivityTimelineEventPresentation(raw).category, 'requests');
    assert.equal(getActivityTimelineEventPresentation(raw).requiresAttention, false);
    assert.equal(filterActivityTimelineEvents([normalized], 'requests').length, 1);
    assert.equal(filterActivityTimelineEvents([normalized], 'needs_attention').length, 0);
  }
});
