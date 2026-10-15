# Media API scale and Linux socket design

This slice closes the two evidence gaps from the
[inspection API outcome](MEDIA_INSPECTION_API_OUTCOME.md): the previously
incomplete noise/eight-binding selection and real Linux Unix-socket reads.
Application source, database schema, current inspection/hash work, executor
defaults and fixture resource limits remain unchanged.

## Explicit validation lanes

The existing guarded workload command selects only noise/eight bindings/one
pair, owned execution, API inspection and bounded diagnostics. It retains the
same canonical apply, forty current media inspections, private durable/result/
digest comparisons and original pool/checkout/scenario limits. One selected
successful collection is not a new twenty-four-sample matrix or a diagnosis of
historical failures. No retry is part of the command.

For Linux, a separate explicit native test uses an existing media image plus a
reviewed Docker CLI image. A fixture Dockerfile copies only the CLI
binary using two named image build contexts. It does not install a distribution,
fetch application dependencies or change the production Dockerfile. The resulting
local fixture is invoked by immutable image ID and is never published.

`media-linux-proof-policy.js` validates the separate runner's complete ID, image,
random label, Node entrypoint/command, disabled inherited healthcheck, root user,
no network, read-only filesystem, no privilege/capabilities, no-new-privileges,
restart policy and exactly two read-only nonrecursive mounts. These are a minimal
owned code/input bundle and the daemon's Unix socket. Effective mount destinations
and read-only flags are checked as well. Socket access remains privileged:
a read-only socket mount does not provide daemon-side GET-only authorization.
Only trusted project test code receives it; the media owner and application do not.

`media-linux-proof-runner.js` owns bounded CLI create/attached-start/inspection/
stop/removal through the acknowledged ID. Canonical close seals admission and
drains attached work. An attached-command deadline cannot certify container exit;
close verifies actual stopped/no-exec state before removal. Unknown creation or
changed ownership grants no guessed cleanup. The captured private root is checked
again after removal, and uncertain runner cleanup retains the parent workspace.

`media-linux-socket-scenario.js` executes under Linux Node in that runner. Native
Linux CLI version/identity reads and API bootstrap must match each other and the
host's privately captured daemon ID. Three current API inspection responses must
equal the host CLI's full acknowledged snapshot. The reader is closed and late
admission must refuse. Only a minimized platform/version/state/count/close summary
reaches stdout; entrypoint failures exclude raw assertion payloads.

The host owns one separate media container throughout running, acknowledged
detached-exec and stopped states. Each state gets a short-lived reader runner;
the active exec must be observed before proceeding. The host retains mutation
authority and verified retirement/removal. The Linux process has no fixture
mutation command interface. This proves Linux socket/CLI/API reading on Docker
Desktop's Linux daemon, not a separate bare-metal distribution or Linux media
filesystem/lifecycle deployment.

## Reproduce deliberately

Run the existing largest selection with a verified local media image:

```powershell
node --expose-gc scripts/measure-wanted-guarded-workload.js --source-noops --profiles noise --bindings 8 --pairs 1 --media-execution owned --media-inspection api --media-diagnostics on --output .tmp/media-api-largest.json
```

For the native socket lane, review the two existing image identities first.
Supply `media_source=docker-image://<verified local media reference>` and
`docker_cli_source=docker-image://<reviewed CLI repository digest>` through
`docker build --build-context`, with `--pull=false --network none --iidfile` and
`-f testing/docker/media-linux-socket.Dockerfile`. A unique temporary local alias
may bind an untagged media image ID; verify its identity before removing that
alias. BuildKit image references and CLI configuration IDs are different inputs.
Neither build context contains host credentials or a host Docker config directory.

Set `HARMONIARR_INTEGRATION_MEDIA_IMAGE` and
`HARMONIARR_INTEGRATION_LINUX_READER_IMAGE` (the latter must be the complete image
ID), then run the literal test path with `node --test --test-concurrency=1
test/integration/media-linux-socket.test.js`. Scope/restore both environment
variables. The new native lane is opt-in; no slow matrix or extra daemon privilege
is added to the fast gate. Missing explicit images are a prerequisite boundary.

## Recommendation stack

| Choice | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Focused workload plus explicit native socket proof | Keeps actual current reads, stable state/identity comparisons and bounded cleanup; efficient selection | One-host evidence; trusted socket access must stay explicit | Implemented |
| Immediately enable API execution in every fixture | Could remove more CLI startup | Reusable cleanup ownership has not been audited | Defer |
| Install another Linux environment or expose TCP | More deployment coverage is possible | Changes host/deployment state and adds unnecessary authority | Unnecessary for this read boundary |

Final stack: preserve defaults -> explicit owned API pilot -> exact guarded
selection -> isolated native socket proof -> audited fixture adoption. Next audit
the reusable app runtime's scenario and outer workspace cleanup owners before
adding an opt-in executor there. The functional runtime's guard cannot silently
stand in for the reusable runtime's separate cleanup boundaries.

See [official research](MEDIA_API_SCALE_RESEARCH_2026_10.md) and the separately
recorded [outcome](MEDIA_API_SCALE_OUTCOME.md) for evidence and limits.
