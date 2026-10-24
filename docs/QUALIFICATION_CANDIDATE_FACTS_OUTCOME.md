# Minimal qualification facts outcome

October 24, 2026. Completed the fact/lock reduction recommended by the
[bounded restart outcome](BOUNDED_RESTART_QUALIFICATION_OUTCOME.md). See the separate
[design](QUALIFICATION_CANDIDATE_FACTS_DESIGN.md) and
[official research and tradeoffs](QUALIFICATION_CANDIDATE_FACTS_RESEARCH.md).

## Implemented behavior

Restart requests and each owned qualification step now read explicit saved policy
facts in SQL, rather than full failed-candidate detail and its file collection.
The dedicated owned-review query reuses canonical review/conflict fragments while
omitting unrelated prepared-add facts and their file-count query.

Small ESM scope-reader and current-guard factories share policy and authorization
between qualification and selection. Qualification locks only the failed parent
with FOR UPDATE, then rereads current facts. Selection retains its original full
candidate/file/decision path. Parent mutation/delete and incoming review-evidence
FK serialization remain intact. Qualification rejects selected-candidate input.

The explicit projection retains missing versus JSON null, legacy queue precedence,
numeric floors, recipient ownership, fallback consent, shared-track participants
and stale-catalog refusal. Durable progress-context digests match full detail.
Account/maintenance/wanted/admission ordering, owned runs, leases, cancellation,
fixed expiry, bounded scans, NOWAIT revision fencing and atomic intent/audit/
completion retain their existing authority. Public status and selection/download
semantics are unchanged. No migration, dependency, route or separate service.

## Executed evidence

- Seventeen focused unit cases passed before the completed stable fast gate.
  The gate passed 11,113 tests: 5,933 server, 4,480 client and 700 scripts, plus
  lint, repository policies and production builds. Code remained frozen afterward.
- Forty PostgreSQL cases across eleven files passed, including the new shared
  parity fixture and four actual HTTP/scope cases, bounded restart, selected-match,
  paging/scan, revision, fence and 224 query-plan profiles. Child locks do not stall
  restart; an observed parent wait rereads a committed 512 kbps floor. Legacy
  context, explicit malformed markers and real shared-track ownership are covered.
- The shared fixture compares actual full and SQL-minimal reads in 27 policy
  scenarios, including five explicit presence/stale-track refusals. Its candidate
  has 2,048 files and 2,048 decisions. The largest serialized minimal record was
  921 bytes; the smallest full record was 1,188,240 bytes. It independently observed
  legacy child-lock waits and retained parent mutation/delete/evidence-FK waits.
  The fixture passed on host PostgreSQL 18.3 and packaged PostgreSQL 18.6.
- Nine browser cases across six suites passed: checking → reload → queued,
  keyboard/focus, continuation, stale refresh, selection and preflight feedback.
- Schema verification passed: 115 applied, zero pending/unknown/checksum drift,
  fresh snapshot bootstrap 115/115 and all 164 critical anchors matching.
- The standards/testing skills validate. Their practical
  [fact and lock reference](../.agents/skills/harmoniarr-web-standards/references/qualification-candidate-facts.md)
  records field presence, shared policy, parent/FK compatibility and real proof.

The [Docker outcome](LOCAL_DOCKER_QUALIFICATION_CANDIDATE_FACTS_OUTCOME.md) records
the no-cache preserved-state rebuild, native fixture and both passing maintained
media validators. GitHub MCP found no open PRs at selection and final recheck, so
there was no applicable random PR, merge, stale cleanup or rebase. Human screen-
reader/physical-device acceptance remains deferred by the user. No release.

## Recommendation and next item

Adopt the dedicated SQL projection, shared ESM policy/guard factories, explicit
qualification entry point and parent FOR UPDATE within the existing owned-run /
bounded-window / NOWAIT-fence / atomic-publication stack. Benefits are smaller
returned facts and removal of irrelevant child access and lock waits. Costs are
an explicit policy-field contract, variable required context arrays and possible
JSONB decompression. These fixture bytes do not establish latency, RSS, physical
I/O or a new concurrent deployment memory envelope.

Next: **remove full failed-candidate detail/file loading from the read-only
quality-review detail/chooser scope**. Reuse the proven fact boundary only after
proving public review/status, current access, page/cursor freshness and eligible
choice parity. Keep selected-candidate command locks separately qualified. This
addresses the remaining full allocation during each chooser/detail read; mixed
workload memory measurement and orphan-revision retirement remain later work.
