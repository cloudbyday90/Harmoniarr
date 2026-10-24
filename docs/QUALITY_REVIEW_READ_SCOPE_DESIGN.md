# Minimal read-only quality-review scope

October 24, 2026. Extend the proven
[qualification fact boundary](QUALIFICATION_CANDIDATE_FACTS_DESIGN.md) to the
quality-review chooser reached by Missing Music detail reads.

## Boundary and implementation

Missing Music resolves the actor/household target before reading alternatives.
The page service constructs current review/recipient policy, checks active
qualification, binds a cursor to actor, target, failed search, current revision,
participants and effective policy, then scans bounded alternative facts. The failed
candidate's full payload and files do not contribute to those decisions.

Reuse the existing SQL fact store and shared scope reader. Internally call the
minimal reader `readFactScope` and inject it into the page service and qualification
guard. Preserve the existing `readQualificationScope` method for callers. Full
`readScope` remains on selection's mutation guard. No additional service, cache,
singleton, endpoint, schema or dependency is needed.

| Boundary | Facts and authority |
| --- | --- |
| Missing Music target resolution | Existing authenticated household/owner checks and public projection |
| Alternative pages | Minimal owned review/failed policy facts, bounded scan and signed current cursor |
| Restart qualification | Same minimal facts, existing fresh transaction guard and parent lock |
| Selection command | Existing full scope, candidate/file/decision locks and fresh authorization |

Policy keys, explicit null versus missing, legacy queue precedence, shared ownership,
consent and track-catalog verification remain unchanged. Checking states, incomplete/
empty windows, reverse navigation and queued feedback retain their meanings. A
cursor remains navigation state, not command authority.

## Proof and limits

Compare actual full/minimal pages using one key/clock, including exact forward/
backward cursors and refusal. Extend the shared 27-case SQL/native fixture to compare
cursor-context digests alongside quality/search/progress policy. Observe real GET
dispatch with unrelated failed payloads and 2,048 extra files: require the minimal
query and exclude full row/file/decision/raw reads and mutation locks from that
subread. Prove GET leaves domain runs, audits, events and discovery evidence intact.

Exercise owner/foreign-target access, legacy floor, malformed scope, disabled shared
recipient and stale continuation through HTTP. Current paging/scan/restart/selection
and browser cohorts own composition and feedback. Human screen-reader/device
acceptance remains separate and deferred.

Only the chooser's redundant full candidate/file subread is removed. Outer Missing
Music projection queries remain, including canonical review/conflict and prepared-
add facts. Required context arrays remain variable; PostgreSQL may decompress JSONB.
Neither this change nor fixture bytes establishes whole-request I/O, latency or RSS
bounds.
