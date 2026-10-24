# Durable initial audio review

Use when a media preflight refuses before an apply run exists. Read the active
repository's docs/PREFLIGHT_QUALITY_REVIEW_DESIGN.md and its research/outcome.

Trace the actual gate, prepared-add guard, candidate transition, scoped read,
detail normalization and rendered recovery panel. A returned still_needs_review
or server-only field does not prove durable or visible guidance.

- Separate an unready preview from a measured negative gate. Retain that gate
  for classification; never infer a transcode from unavailable tooling.
- Measure outside locks. Publish through the existing prepared-add guard with
  current maintenance/account/wanted/discovery/creation/candidate/decision locks
  and fresh candidate/recipient/policy comparisons. Reuse its owning queryable
  for candidate stop, event and required audit. Required failure rolls back all.
- Persist media_verification plus a normalized reason, keeping the downloaded
  file. Do not allocate an apply run, count a new attempt, penalize the source,
  grant fallback consent or start recovery solely to record a review.
- Build public guidance from static allow-listed copy. Conflicting current work
  must not inherit stale review guidance. Keep paths, peer bodies, raw tool output
  and sibling policy out of detail, diagnostics and Activity projections.
- Preserve the field through useMissingMusicDecisionDetail normalization. Reuse
  the existing recovery panel, server permissions, command mutation gate and
  refresh/focus/status handling. A measured suspicious-lossless/quality stop is
  review-only; an interrupted audio check may use the existing prerequisite recheck
  after a fresh passing gate. Read-only history does not authorize a command.
- Prove SQL rollback, concurrent publication, policy/source/recipient drift,
  bounded fresh HTTP reads, authorization/CSRF, command replay and rendered reload.
  Injected gates establish SQL/HTTP composition; packaged real media establishes
  actual measurement. Keep screen-reader/device acceptance separately recorded.

For worker-time media drift, use a distinct valid acquisition. Admit valid
task-owned bytes through the actual guard, then restore rejected bytes before
the worker starts. Never reopen an initial measured rejection in fixture SQL or
weaken quality to manufacture an apply run. Require durable initial review and
worker refusal separately in aggregate evidence. Await owned worker completion
and verify disposable project/workspace retirement.
