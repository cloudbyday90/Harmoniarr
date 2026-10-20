# Isolated native provider fixture outcome

Date: 2026-10-20. Implements the [design](NATIVE_SLSKD_FIXTURE_DESIGN.md).

## Implemented lane

The explicit validate:native-slskd command runs one native case with direct and
completed-response-loss scenarios. Ten new ESM files separate bounded frame/
string handling, owned socket close, central/peer policy, container entry,
manifest data, actual-client assertions, Compose configuration, Docker runtime
and the focused/native tests. package.json adds only the command; the lock and
all application source, provider pin and exact version guard remain unchanged.

The current server/shared/fixture source is mounted read-only into an immutable
app image for its canonical Node and installed dependencies. The driver checks
the exact lock and mounted policy bytes. The actual provider runs independently
with its own temporary state. Both services are non-root/read-only, drop all
capabilities, use bounded memory/PIDs/storage and attach only to one inspected
internal network. No port is published. Generated secrets stay in owned files;
no public account, peer, search or media bytes are used.

## Evidence boundaries

The final native collection passes on Linux/amd64 under Node 24.22.0 with
provider 0.26.0.0. Two actual batch requests return 201 and four provider-generated
receipt IDs are bound to the exact caller UUID, peer, filenames and sizes.
Native batch/detail GETs show all four remotely queued with zero transferred
bytes. Wrong filename, size, batch, ID or peer reads are refused. Client-side
loss after complete native 201 processing recovers through owned GET evidence
without another POST. This is not a packet-loss emulator or completed transfer.

The final explicit native case completes in 15.1 seconds, with two scenarios,
zero skips/cancellations and strict project cleanup. It binds the final source
fingerprint below to immutable app image
sha256:39427ddc8947a6d507ef0b6f12e8f8f38a08c68d2e551933a3d1a8ad54d1ce80
and provider image
sha256:ecd4026d4f8fb504e2cc55323efa2c1f5b56d20d3686b018249cc36b48ea17a6.
The app image supplies runtime/dependencies; the application client is the
current mounted source, not a claim about an unmounted historical server bundle.

Eight focused cases pass framing at every split/coalesced boundary, length/UTF-8/
EOF refusal, authentication/peer/file scope, held-socket close, image-input
refusal and original Error/null preservation after a later cleanup failure.
Unacknowledged startup retains owned files even after teardown commands.
Successful cleanup requires fixture socket closure, stopped container state,
project container/network/volume absence and verified workspace removal.

Source is frozen at 3,060 files with SHA-256
ca7f6d9bc2ab928e6ac25604b6233e6fd6b72cc6141957cf544e1775f95992d5.
Private collections remain under .tmp/native-peer-2026-10-20.

On canonical Node 24.22.0/npm 12.0.2 the final validate:fast invocation passes
10,565 tests: server 5,480, client 4,388 and scripts 697, with lint, policy checks
and both builds. It takes 132.7 seconds locally. The eight focused cases overlap
that inventory; native scenarios remain a separate opt-in case. These timings
are observations, not a matched before/after suite-speed claim.

The subsequent [walkthrough rebuild](LOCAL_DOCKER_NATIVE_FIXTURE_OUTCOME.md)
passes healthy preserved-state startup, existing-admin bootstrap and readiness-
only checks. Packaged server/client/shared files and runtime package inventories
match the prior image. Provider attention remains a separate operational issue.

## Retained failures and limits

Early private prototypes exposed missing download directories, bundled SQLite's
need for executable extraction, and an unavailable host API binding on the
internal-only network. The final design uses dedicated temporary directories,
an executable bounded app tmpfs and an internal API driver.

The first native-lane candidate inherits the app image's unrelated HTTP health
check and fails; disabling that inherited check fixes setup without increasing
the startup limit. The second reaches native receipts but an assertion compares
later queue state with direct durable identities. Compare all identity fields
exactly and verify native state separately. Those failed collections remain
separate from later passing proof. Lint also rejects five implicit promise-
executor returns; the final code uses explicit executor bodies.

No public Soulseek behavior, completed media, provider restart retention,
active Docker cancellation, ARM or hosted CI qualification is claimed. Existing
PostgreSQL authority tests remain separate; this fixture does not replace them
or add Docker startup to routine fast validation.

## Recommendations and PR

The [official research and alternatives](NATIVE_SLSKD_FIXTURE_RESEARCH_2026_10.md)
recommend this opt-in lane with the existing application stack. The random
[PR 48 review](OPEN_PR_48_NATIVE_FIXTURE_EVALUATION.md) verifies unchanged head,
lock and tooling applicability against its retained failed candidate/control;
there is no new install or package upgrade this round.

Next: review slskd 0.26.1 cancellation/retry changes and qualify its exact native
wire form against this fixture before adopting PR 51. Add completed-transfer
and restart scenarios only as separately owned contracts. Qualify the announced
Node security patch when actually published. No release, Git tag or PR merge.
