# Music Queue Terminal Match Recovery Design

Status: **Implemented.**

Date: 2026-07-30.

This document completes the terminal-match-recovery follow-up in
[ACQUISITION_PIPELINE_REDESIGN_PLAN.md](ACQUISITION_PIPELINE_REDESIGN_PLAN.md).
It extends the release-first Music Queue workflow through terminal download,
quality, and pre-library-add outcomes without returning normal users to the
candidate workbench.

## Problem

An automatic Music Queue release can reach a terminal state after its first
match was chosen. Before this change, parts of that state could be reconciled,
but the reason for the stop was not consistently classified, safely persisted,
or projected back to the release row. That risks either a silent stall or an
unsafe automatic attempt against another match.

The system must distinguish a remote match failure from a local library-add
decision. A retry of a different remote match is safe only when it starts a new
download and cannot overwrite, downgrade, or bypass validation for library
content.

## Official Sources Reviewed

| Source | Relevant guidance | Harmoniarr decision |
| --- | --- | --- |
| [slskd configuration documentation](https://github.com/slskd/slskd/blob/master/docs/config.md) | slskd supports bounded retries with backoff, reports transfer lifecycle state, and separates incomplete and completed directories. | Keep slskd retry behavior provider-scoped. Classify its terminal observations in Harmoniarr and use bounded, release-scoped fallback only after a terminal observation. |
| [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | File-derived processing needs layered validation, controlled destinations, and no trust in unvalidated file input. | Never advance automatically for collisions, lossy acknowledgement requirements, or validation blockers. Keep their diagnostics behind an explicit add-plan review. |
| [PostgreSQL `SELECT` documentation](https://www.postgresql.org/docs/current/sql-select.html) | `SKIP LOCKED` is suitable for queue-like consumers but produces an intentionally inconsistent view. | Retain the existing conditional candidate-status promotion as the atomic ownership gate. Do not introduce `SKIP LOCKED` into the release read model merely to make fallback look concurrent. |

## Outcome Policy

| Terminal observation | Durable candidate result | Automatic next-match promotion | Music Queue result | Source-user outcome |
| --- | --- | --- | --- | --- |
| Failed transfer | Candidate becomes failed. | Yes, after existing retry and quality-policy checks. | `Trying another match`, or the existing exhausted result. | Failure evidence. |
| Timed-out transfer | Candidate becomes failed with `download_timed_out` evidence. | Yes, under the same bounded policy. | `Trying another match`, or the existing exhausted result. | Failure evidence. |
| Provider no longer reports a transfer after the missing-transfer grace period | Candidate becomes failed with `source_disappeared` evidence. | Yes, under the same bounded policy. | `Trying another match`, or the existing exhausted result. | Failure evidence. |
| Verified quality failure | Candidate becomes failed with `quality_failed` evidence. | Only for a quality-eligible successor. | `Trying another match` or `Quality choice needed`. | Failure evidence. |
| Completed download source no longer exists before add | Candidate becomes failed with `source_disappeared` evidence. | Yes, because a new remote download does not alter library files. | `Trying another match`, or the existing exhausted result. | Failure evidence. |
| Collision, lossy acknowledgement requirement, or preview validation blocker | Candidate becomes failed with `import_blocked` evidence. | No. | `Needs help adding` with `Review library add plan`. | No source-user penalty. |

The completed-source exception is intentionally narrow. A missing local source
does not prove the next remote match is good, but it does make a fresh
download-and-verification attempt safe. A collision or validation failure can
be release-wide or environment-wide, so moving to another match would conceal
the condition and could create duplicate or unsafe library work.

## Implemented Design

### Classification

`import-candidate-terminal-recovery-policy.js` owns two pure decisions:

- `deriveTerminalTransferOutcome()` classifies normal provider failure, timeout,
  and a missing transfer only after the configured grace period.
- `evaluateImportBlockerRecovery()` permits automatic recovery only when the
  completed candidate's source is missing and there are no collision, quality,
  or validation blockers.

Provider exception text stays in diagnostics. The release workflow carries only
stable terminal-outcome codes.

### Recovery and Durability

`import-candidate-recovery-service.js` records the failed candidate before it
tries an eligible successor. Existing quality profile checks and the bounded
same-match retry path remain authoritative. The recovery service now accepts:

- generic failed transfers;
- explicit timeouts;
- strict quality verification failures; and
- completed-source and import-blocker outcomes.

Every pre-add blocker records `import_candidate_import_blocked`. Only a
completed-source disappearance increments source-user failure evidence. A
collision remains a local repair state and does not lower a remote user's
reputation.

### Release Read Model and Activity

The wanted-release store reads the latest candidate event for the current
search. The Music Queue status projection prioritizes that durable
`import_candidate_import_blocked` marker over generic failed-match states, so
the release says `Needs help adding` and offers `Review library add plan`.

The new `music_queue_import_blocked` Activity event uses a release-centered
label and a Music Queue handoff. It does not expose raw provider exceptions,
file-system paths, credentials, or arbitrary preview details.

### Concurrency and Safety

The existing guarded status transitions and conditional promotion provide the
ownership boundary. If a concurrent worker already changed a candidate, the
transition fails rather than allowing duplicate promotion. The read model is
informational and intentionally does not claim locks or use `SKIP LOCKED`.

## Approaches Considered

| Approach | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Let slskd retries handle every terminal condition | Minimal Harmoniarr code. | Cannot distinguish release safety from provider retry state; cannot advance across matches or explain a stopped add. | Reject. |
| Promote the next match after every stop | Fastest apparent recovery. | Can bypass collision, quality, and validation safeguards; hides the actionable problem. | Reject. |
| Central terminal-outcome policy with a narrow safe exception | Explicit, testable, and release-centered; preserves the current service boundaries. | Adds a small classifier and durable event projection. | Adopt. |
| Add `FOR UPDATE SKIP LOCKED` to all fallback queries | Familiar queue primitive. | Unnecessary for existing conditional promotion and inappropriate for the read model's consistency needs. | Defer. |

## Final Recommendation Stack

1. Use slskd's configured bounded retry/backoff for transient transfer work.
2. Normalize terminal provider and pre-add outcomes in one pure ESM policy
   module.
3. Guard each candidate state change in the existing transactional transition
   and promotion path.
4. Promote only a quality-eligible next match after a remote failure or
   disappeared completed source.
5. Stop on collision, validation, or quality-policy blockers; persist a repair
   event and link to the release's add plan.
6. Keep raw errors, provider paths, and file-level details in advanced
   diagnostics only.
7. Project stable outcome codes to Music Queue and Activity instead of making
   users interpret candidate statuses.

## Validation

Focused unit coverage proves:

- generic failure, timeout, and disappeared-source classification;
- only missing completed sources qualify for automatic pre-add recovery;
- quality-eligible recovery and strict-quality exhaustion;
- collision and validation blockers never select another match;
- source-user reputation changes only for actual source disappearance;
- the wanted-release read model carries the latest terminal event; and
- Music Queue projects a durable import block as `Needs help adding`.

Schema validation includes the `music_queue_import_blocked` activity-event
constraint and a Docker-generated schema snapshot. A scoped wanted-release
read also executes against a fresh Docker PostgreSQL database, validating the
latest-event projection as real SQL rather than only a mocked store query.

## Follow-up

The next high-value implementation slice is a deterministic browser acceptance
test for this full terminal-outcome matrix: timeout fallback, source-disappeared
fallback, strict-quality stop, and collision stop. It should prove the normal
Music Queue row and Activity handoffs without relying on live peers or exposing
advanced diagnostics by default.
