# Local media inspection API outcome

Implemented on main as an explicit test-infrastructure pilot on October 14,
2026. Three narrow ESM modules own endpoint/version policy, bounded HTTP and
inspection-reader bootstrap/lifetime. `--media-execution owned --media-inspection
api` uses current Engine reads and CLI exec/lifecycle operations. The same
owner/configuration validator serves both readers. Defaults, production source,
SQL/schema, current media/hash work and resource policy remain unchanged.
See the [design](MEDIA_INSPECTION_API_DESIGN.md) and
[official research](MEDIA_INSPECTION_API_RESEARCH_2026_10.md).

## Correctness evidence

The focused collection passed 68 cases in 0.487 seconds: real local HTTP streams,
endpoint precedence/refusal, private daemon/version comparison, original Error/
null, sealed/drained readers and workspaces, hybrid phase/report capture, command
selection and the affected workflow contracts. HTTP cases include fragmentation,
reuse, oversized declared/actual bodies, malformed JSON, premature close, wrong
status/redirect/encoding, stalled headers/body and abort during canonical close.

The final native collection passed seven cases in 28.843 seconds. Both CLI/API
owners re-read changed bytes, deny writes through the mounted fixture and retire
after a real nonzero ffprobe or host exec deadline. API JSON matched exact fresh
CLI inspection JSON for acknowledged owner states; an acknowledged detached
sleep proved nonempty current ExecIDs, refusal of another command and whole-owner
stop with empty ExecIDs before removal. All recorded owner work drained.

Retained initial evidence: a malformed-JSON control exposed a reusable socket
that request destruction alone did not close; explicit socket destruction fixed
it. An initial active-exec candidate compared reads across an unacknowledged
start and failed 1/7 in 33.833 seconds. The fixture now awaits Docker's detached
exec-start acknowledgement before comparing stable reads. This was test setup
ordering, not permission to ignore ExecIDs. The earlier six-case native cohort
passed separately in 26.102 seconds. Final-source controls own final claims.

## Reversed-order canonical selections

Each command selected sine/two bindings/one pair with owned execution and
diagnostics enabled, fresh PostgreSQL ownership and unchanged pool/deadline
policy. Each completed two privately compared compatibility/locked-noop samples,
two generated files and ten actual media inspections. Every current result,
receipt/durable state, digest, byte and work-count comparator remained enabled.

| Order/reader | Command seconds | Measurement ms | Seed ms | Close ms | 25 container reads ms | Bootstrap ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 CLI | 43.872 | 43,733.068 | 9,879.692 | 1,020.189 | 3,150.857 | 0 |
| 2 API | 15.183 | 15,055.359 | 7,975.100 | 695.949 | 118.325 | 905.766 |
| 3 API | 14.737 | 14,602.550 | 7,630.872 | 679.431 | 112.944 | 844.311 |
| 4 CLI | 17.039 | 16,904.338 | 9,810.395 | 973.057 | 3,322.577 | 0 |

Both orders support a reduction in current inspection transport cost. Bootstrap
must be included: the API path adds four CLI and two API bootstrap operations,
then replaces all twenty-five inspection CLI launches with actual API reads.
Thus CLI owners recorded 40 operations/40 CLI launches; hybrid owners recorded
46 operations, comprising 19 CLI launches and 27 API GETs. Bootstrap context has
two calls within one fixed category. Version-two snapshots retain seventeen
categories, `docker_hybrid`, zero pending/failed/untimed counts, no clipping and
verified owner cleanup in all four selections.

Do not attribute the first command's large setup difference to this adapter.
Seed/close windows include other work, and returned transport time includes
daemon/stream handling. These are two small observations per reader on one host,
not a whole-CI speedup, overhead bound, maximum latency or historical timeout
diagnosis. The earlier incomplete noise/eight-binding results remain incomplete.
No inspections were cached, sampled away or replaced with metadata.

## PR and maintained skills

The frozen-code `validate:fast` gate passed in 130.806 seconds: 5,227 server,
4,384 client and 568 script cases (10,179 total), with zero failures, cancellations
or skips, plus lint, copyright, migration/schema/ESM/Compose policy and client/
server builds. The npm audit reported zero vulnerabilities. The full twenty-four
sample matrix and native Linux domain-socket deployment were not run this round.

Random selection from two open PRs chose [PR #42](https://github.com/cloudbyday90/Harmoniarr/pull/42).
Its five workflow files now use the verified v7.0.2 artifact-upload commit; three
local workflow contract modules track that pin. Affected workflow tests passed
locally. Hosted artifact upload/retry behavior needs GitHub Actions, so local
tests do not claim it. The PR was neither merged nor rebased; no release/tag was
created. The existing release workflow still requires explicit dispatch.

The practical standards/testing skills now map official Docker/Node guidance,
OWASP minimization and W3C draft timing to concrete target, read, cleanup and
evidence owners. Repository standards/testing and installed standards skill
validation passed. This is a focused reference update, not a new blind skill
trial, WCAG conformance claim or daemon-side authorization layer.

## Recommendation and next item

The [local walkthrough](LOCAL_DOCKER_WALKTHROUGH.md) was rebuilt with
`docker compose --progress plain -f compose.walkthrough.yaml build --no-cache
harmoniarr` in 47.655 seconds, then `up -d --wait --no-build harmoniarr` completed
in 11.313 seconds. The one-shot bootstrap helper exited zero and confirmed the
existing admin. `/healthz` and `/` returned HTTP 200 on localhost port 47956;
bootstrap status required no new admin. Existing walkthrough data was retained;
no reset, external-provider/managed-provider setup or release rehearsal was run.
No media fixture containers remained after validation.

Keep per-command execution and owned CLI inspection as the current defaults.
Use the hybrid adapter explicitly for guarded workload investigation: its measured
read savings justify the pilot, while local-only/API-version/platform scope and
bootstrap cost argue against immediate default promotion. Keep full API exec/
lifecycle migration deferred because it adds framing and mutation/cancellation
authority without current proof.

Next collect the previously incomplete noise/eight-binding selection through
this adapter with the same guards and failure checkpoints, then prove native
Linux socket behavior before expanding adoption. Neither a larger pool nor a
longer deadline is part of that recommendation. Private logs, source hashes and
selected artifacts remain ignored under `.tmp/media-read-api-2026-10-14/`.
