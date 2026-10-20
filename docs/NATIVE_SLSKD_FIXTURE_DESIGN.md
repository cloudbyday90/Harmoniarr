# Isolated native provider batch fixture

Date: 2026-10-20. Follows the [wire-version outcome](SLSKD_WIRE_VERSION_OUTCOME.md).

## Scope and boundaries

Run the real reviewed slskd 0.26.0 image with an owned central-server/peer
protocol fixture on one internal Docker network. The fixture admits only its
generated login and one peer/file manifest. A remote-queue acknowledgement
allows native batch creation and exact receipt reads without media bytes,
public accounts, search or public Soulseek connectivity.

Keep this explicit native lane outside routine fast and complete PostgreSQL
inventories. Require local immutable provider/application image inputs. Inspect
image, network and read-only mounts before authenticated requests. Publish no
ports; run the API driver inside the internal network against mounted source.
Use temporary generated secrets, non-root/read-only containers, dropped
capabilities and bounded temporary storage. Retire acknowledged containers and
the network before removing owned files; retain data after uncertain cleanup.

## Implementation plan

Use small ESM modules for bounded frame/string codecs, owned TCP socket lifetime,
the central/peer message policy and Docker runtime. Reuse the actual application
client, dispatch, batch decoder and exact transfer reader. Do not insert provider
database rows or substitute an HTTP receipt mock for native behavior.

Prove native 201 acceptance with the saved caller UUID, full manifest and actual
provider-generated receipt IDs. Read the same batch and exact transfers, refuse
wrong receipt identity and preserve uncertainty rules. Test malformed protocol,
fragmented/coalesced input and held-socket cleanup separately without Docker.
Remote queue admission is earlier than completed download or library import.

The application image supplies canonical Node and matching installed server
packages; compare the lock and mounted policy bytes before scenario execution.
The provider's bounded app tmpfs permits executable native-library extraction;
other writable locations keep their default non-executable tmpfs policy.

The default provider pin and support guard remain unchanged. Qualifying 0.26.1
is a later decision after this stable native contract is established.

See the separate [research](NATIVE_SLSKD_FIXTURE_RESEARCH_2026_10.md) and
[outcome](NATIVE_SLSKD_FIXTURE_OUTCOME.md).
