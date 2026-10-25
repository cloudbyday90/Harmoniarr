# Mixed artwork corpus outcome

October 24, 2026. Completed the corpus follow-up from the
[mixed review outcome](DEPLOYMENT_REVIEW_MEMORY_OUTCOME.md). See separate
[design](DEPLOYMENT_REVIEW_CORPUS_DESIGN.md),
[official research/tradeoffs](DEPLOYMENT_REVIEW_CORPUS_RESEARCH.md) and
[Docker outcome](LOCAL_DOCKER_DEPLOYMENT_REVIEW_CORPUS_OUTCOME.md).

## Implemented behavior

Added owned corpus selection/input/output verification, publication/refusal
settlement and a shared mixed-review qualifier as narrow ESM helpers. The baseline
and new native entries use the same qualification body. The shared provider fixture
now serves the actual image MIME, including WebP. Existing ordinary/maximum-pixel/
maximum-byte paths remain supported. No production service, resource control,
decoder, route, schema, UI, dependency or version change.

Each fresh case retains the real app, authentication/CSRF, TLS image transfer,
ingestion/admission, media workers, PostgreSQL work and review queue/lease owners.
Accepted images verify source/stored hashes, format, dimensions/alpha and metadata
removal. PNGs preserve the canonical decoded eight-bit projection; input sample
depth is verified independently. This does not preserve full sixteen-bit precision.

The large RGBA16 PNG case requires two actual `artwork_worker_memory` 503 outcomes,
no publication lookup, asset, file or assignment, and normal child retirement.
Review/media work must still complete and release its leases. Refusal never waits
on the successful publication checkpoint. Large refusal input is not raw-decoded
in the parent process.

## Final-image measurements

Seven cases ran at each declared cap, one fresh container/database per case/profile.
Each has two CPUs, 256 PIDs, equal memory/swap caps, read-only root, no network or
published ports and disposable data. Node 24.22.1 and PostgreSQL 18.6 share the
measured cgroup; Sharp/libvips remain 0.35.5/8.18.7 and FFmpeg 8.0.1.

| Fixed input | Input bytes | 2 GiB lifetime peak, MiB | 3 GiB lifetime peak, MiB | Result per profile |
| --- | ---: | ---: | ---: | --- |
| 1024² RGB8 PNG noise | 3,147,780 | 728.7 | 731.4 | Two published images |
| 1024² RGBA8 PNG noise | 4,196,676 | 751.5 | 740.2 | Two published images |
| 1024² grayscale16 PNG noise | 2,098,884 | 731.0 | 727.5 | Two published images |
| 1024² RGBA16 PNG noise | 8,392,260 | 755.5 | 777.5 | Two published images |
| 1024² JPEG noise / EXIF | 864,667 | 714.4 | 712.4 | Two published images |
| 512² WebP noise | 219,904 | 711.4 | 703.4 | Two published images |
| 8192² RGBA16 PNG pattern | 8,184,332 | 724.5 | 727.4 | Two owned capacity refusals, zero publication |

These are **cgroup v1 approximate-usage** lifetime peaks, including initialization,
input/media generation and setup/cleanup. Sampled current peaks, Node RSS/heap/
external/ArrayBuffers, logical reservations and durations are recorded separately.
Do not add overlapping fields. Failcnt and OOM-kill counters did not increase;
the unavailable v2 OOM-event field remains null.

All eight measured HTTP operations completed within scan/encoder lifetime overlap
in each corpus run, followed by successful owned qualification completion. The
three qualification steps, three media runs/four leases, actual native close,
artwork reservation settlement and every original media hash were verified.
Each case retains 256 MiB caller bytes, two 100,000-row sorts, 64 scan/tag files,
four probes and real null-output encoding. HTTP observations ranged 86.7–773.1 ms
across these selected runs; they are not an SLO or controlled latency comparison.

The rerun 8192-pixel baseline mixed case peaked at 1,464.8 MiB under 3 GiB. Its
dimensions differ from the accepted corpus samples; lower corpus peaks are not a
memory improvement. None of these figures establishes a production minimum,
maximum accepted-file envelope or arbitrary decoder complexity bound.

## Validation and recommendation

Seventeen focused selector/pixel/metadata/observer/drain checks passed. The stable
fast gate passed 11,120 tests: 5,940 server, 4,480 client and 700 scripts, plus lint,
repository checks and builds. Eighteen final native tests passed in sixteen fresh
containers: fourteen corpus tests, three default memory regressions and one baseline
mixed-review regression. Preliminary smoke runs remain separate. Code/alias were
frozen through final qualification.

Standards/testing skills validate and include the practical
[mixed corpus reference](../.agents/skills/harmoniarr-web-standards/references/deployment-review-corpus.md).
Unchanged SQL/browser/provider evidence is retained through verified source/runtime
identity. GitHub MCP found no open PR at selection or recheck; no random PR, merge,
stale cleanup or rebase applied. Human screen-reader/device acceptance remains
deferred; actual HTTP checking/queued status is separate evidence. No release.

Retain current container limits, native/artwork admission, exact leases, bounded
review facts/scans and owned decoder refusal. Benefits are real composition and
separate success/refusal proof. Costs are explicit opt-in containers and a deliberately
selected corpus. No new resource policy is justified by these passing cases alone.

The maximum-resolution JPEG/WebP follow-up is now recorded in the
[maximum artwork outcome](DEPLOYMENT_MAXIMUM_ARTWORK_OUTCOME.md), including its
native-failure containment finding. Use that outcome's next item before adjusting
reservation headroom or recommending a deployment minimum. Multi-owner concurrency
remains a separate unmeasured dimension.
