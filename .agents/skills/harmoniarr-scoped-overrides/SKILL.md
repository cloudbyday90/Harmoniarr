---
name: harmoniarr-scoped-overrides
description: "Implement or review target-owned acquisition policy exceptions in Harmoniarr, tracing saved consent through shared discovery and downstream verification. Use for quality fallback or similar scoped overrides; ordinary UI styling and unrelated settings are outside this skill."
---

# Harmoniarr Scoped Overrides

Complete the exception's ownership and effective-consumer journey. A saved flag
is insufficient evidence that the worker applies the intended policy.

## Establish authority and scope

Identify the selected wanted release, its recipient, and the authenticated actor.
Resolve that recipient's saved preferences or explicit scoped profile separately
from the shared discovery summary. Shared worker findings describe observations,
not another recipient's policy authority.

Trace every reader and writer of the override before changing it. For acquisition
work, read [the consumer map](references/acquisition-consumer-map.md). Inspect
current source; the map locates boundaries and does not replace the implementation.

## Preserve the policy boundaries

- Persist consent on the selected wanted/discovery link, bound to its wanted ID.
  Never copy it into sibling links or treat a shared evidence flag as consent.
- Retain the actual shared participant set. Unknown policy, invalid consent, or
  disabled participants remain conservative; do not drop an owner to satisfy a
  shared-policy condition. A disabled account cannot grant new consent.
  Distinguish unknown policy from legitimate account defaults and partially saved
  preference objects; inspect the existing normalization contract.
- Compute effective shared preferences from each participant's requirements and
  valid choices. One recipient's exception cannot lower another's requirement.
  Explain when a saved choice must wait for other recipients or a later search.
- Preserve saved numeric minimums as well as profile names. Intersect permitted
  formats and retain the highest applicable bitrate floor in actual selection and
  downstream context; a search-ranking score alone does not enforce a minimum.
- Keep base inspection/verification policy separate from broadened search
  preferences. Allowing lossy search does not approve falsely advertised lossless
  media, waive media/filesystem/safe-add checks, or promise an upgrade worker.
- Use actual persisted worker evidence for current facts. Prior findings must not
  authorize commands after a new retry or active handoff has begun.

## Make the command durable

Reuse the current guarded write and lock order, with fresh actor/target eligibility
and current resource state. Commit scoped choice, retry intent, and required audit
together. Missing target links must refuse all writes. Reuse durable idempotency;
an uncertain client retry retains its intent key, and already-saved consent under
a new key must not duplicate audit or reset shared work.

Treat dispatch as post-commit work. Return the durable queued truth if the worker
cannot start immediately. Public projections expose bounded policy facts and
server-derived permission; omit raw provider bodies, paths, actor metadata, and
verification internals. Use small ESM policy/service/store modules.

## Prove the effective behavior

Choose focused evidence for the changed boundary: recipient authorization,
missing/disabled links, mixed and unanimous consent, unknown policies, stale
findings, concurrent commands, atomic rollback, replay, and actual worker search
preferences. Include a below-floor candidate and a claimed-lossless verification
case when changing quality behavior. Use real PostgreSQL tests for transactional
or concurrency claims and browser tests for newly exposed commands.

Report the saved choice, effective shared result, remaining verification gates,
and evidence limits separately. Preserve the user's branch, release, publication,
and external-action instructions; this skill adds no authorization.
