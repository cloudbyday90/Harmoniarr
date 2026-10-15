# Linux canonical media validation outcome

Date: 2026-10-15. Implemented on main; no release, tag or image publication.

## Delivered lane

`npm run validate:linux-canonical-media` now selects only the unchanged six-case
canonical Add to library file. It refuses unsupported platform/runtime, mutable
or unavailable media image, borrowed PostgreSQL, altered resource policy,
contradictory selection, skips and incomplete media work. Local CLI/API identity
and API 1.56 capability are verified before PostgreSQL. Reader disposal and
actual native stream completion are awaited; malformed evidence cannot become
green after later successful events.

The new ESM modules separate pure admission/evidence, read-only prerequisites,
native event/environment lifetime and the CLI. The manual-only Ubuntu 24.04
workflow checks Engine capability before install/build, uses read-only token
permissions/reviewed action pins and builds an immutable local fixture image.
It adds no automatic integration workload. Existing cohort/default execution,
production files and schema are unchanged.

On a native Linux host with a reviewed local Engine:

```sh
mkdir -p .tmp/linux-canonical-media
docker build --file testing/docker/canonical-media.Dockerfile --iidfile .tmp/linux-canonical-media/image.iid .
HARMONIARR_INTEGRATION_MEDIA_IMAGE="$(cat .tmp/linux-canonical-media/image.iid)" npm run validate:linux-canonical-media
```

No file/name filters are accepted. A missing prerequisite or unsupported API is
a failed lane, not a successful skip or an automatic fallback. The CLI emits a
bounded aggregate result or fixed refusal code. For private failure diagnosis,
rerun the literal canonical file with normal Node reporting in the same trusted
environment; do not publish raw private fixture output.

## Real Linux replay

The final frozen sources ran uninstrumented in the trusted Linux fixture on
Docker Desktop's Linux Engine 29.8.2/API 1.56. Node was 24.21.0. The complete lane
reported six passed cases, zero skips, eight generated files, 27 current
inspections, three created/removed owners and verified media cleanup. Native
lane elapsed time was 49.235 seconds; outer create/attach observation was
50.908 seconds. These are validation observations, not a matched speed benchmark.

The final runner/media image was
`sha256:5655ea74cbd887e9fe2a8429b414be3401f10fa637670e01da18b5f0e4b76492`.
The base Node image digest came from acknowledged local Docker metadata; npm
dependencies came from the existing lockfile. The specific build context admits
only required source/package/test paths and excludes credentials and local data.

The owned volume's acknowledged daemon Mountpoint was mounted at the same Linux
absolute path inside the runner and selected as TMPDIR. This exercised real
Linux path identity, private directories, codec inspection, file movement and
Unix API/CLI lifecycle. Testcontainers used the Desktop host gateway and normal
reaper. Canonical media owners retained their no-socket/network-none/read-only
inspection configuration. The trusted runner had a read-only root, dropped
capabilities, no-new-privileges and a PID limit of 128, plus privileged daemon
socket access needed for this test infrastructure.

The parent verified the acknowledged runner stopped before removing it. Its
volume contained only the inactive Testcontainers lock file; a read-only check
verified that regular file and exact volume label/path before volume removal.
Earlier failed/uncertain replay volumes remain retained. No arbitrary host or
production mount was removed.

## Controls, initial failures and limits

Eight focused tests pass: early refusal before prerequisites, fragmented native
records, exact inspection/lifecycle work, skip/summary/record/cleanup/size
refusal, reader pinning/disposal, original null, held stream drainage, concurrent
environment refusal, and original Error/null plus complete environment restore.

An early build used a bare image ID as a Dockerfile FROM argument, which BuildKit
interpreted as a repository name. The corrected fixture uses the acknowledged
`node@sha256` repository digest. An initial replay failed and was not counted as
passing evidence. An eval-based diagnostic recursively inherited its parent
arguments; the verified runner was stopped. Source inspection established that
Node's execArgv option appends rather than clears inherited eval arguments.
The lane now refuses eval/print/input-type entrypoints before preflight, and a
regression control verifies that refusal. The successful diagnostic and final
runs used file entrypoints. Failed evidence has not been recast as success.

The complete fast gate passed in 271.278 seconds: 5,267 server, 4,384 client and
568 script tests, totaling 10,219, with zero failures/skips. Static policy, lint
and both builds passed; the production-only dependency audit reported zero
vulnerabilities. A final guard refinement also rejects Node's valid combined
short `-pe` form. Focused controls, lint and the full Linux cohort were rerun for
that final source; gate and final manifests are retained separately. No larger
integration/scaling matrix or speed attribution is claimed.

The manual workflow YAML parsed and its sole dispatch trigger, read-only
permissions and Ubuntu target were verified. Both repository skills and the
installed standards skill passed structural validation; four installed standards
files matched repository bytes. Structural checks are distinct from behavioral
proof and do not claim a new blind skill trial. The native image's three runtime
modules, CLI entrypoint and canonical test match the recorded working source.

Initial and final GitHub MCP collection reads returned zero open PRs. No
applicable random PR existed, so no PR patch, rebase, merge or comment occurred.

The passing replay proves this Linux container/daemon configuration. The new
manual Ubuntu workflow has not been dispatched or claimed green. It deliberately
refuses a hosted runner without reviewed Engine capability. This is not full
Linux distribution, non-root-host or whole-CI performance certification. Existing
defaults remain conservative.

Private source/image manifests, native logs, retained-failure metadata and gate
evidence remain ignored under `.tmp/linux-canonical-media-2026-10-15/`.

## Recommendation stack and next item

Keep pure admission/evidence → read-only pinned preflight → one literal native
cohort → existing app/worker/workspace owners → bounded aggregate reporting →
manual CI selection. The benefit is enforceable Linux canonical proof without
green skips or a larger automatic matrix. The costs are privileged trusted
runner access, image/dependency setup and explicit storage ownership on Desktop.
Do not remove current inspections or promote the default from timing alone.

The next implementation priority is PostgreSQL fixture cleanup failure
propagation. A controlled injected adapter reproduced that the existing
[empty-schema runtime](../testing/postgres-integration-runtime.js) resolves cleanup after its server stop rejects (one stop
call). This slice does not alter that shared runtime or certify its failure
path; successful native media-owner retirement is a separate claim. Fix and
verify original failure/retention behavior there before broader default adoption.
Then review a manually dispatched Ubuntu lane result. See the separate
[design](LINUX_CANONICAL_MEDIA_DESIGN.md) and
[official research/options](LINUX_CANONICAL_MEDIA_RESEARCH_2026_10.md).

The subsequent [PostgreSQL cleanup outcome](POSTGRES_RUNTIME_CLEANUP_OUTCOME.md)
completes server-stop failure propagation with separate native ownership proof.
Its strict temporary-database release follow-up remains a separate boundary.
