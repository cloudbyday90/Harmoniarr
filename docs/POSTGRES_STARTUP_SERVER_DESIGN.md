# Owned PostgreSQL server startup evidence

Date: 2026-10-13. Baseline: `2973f4a`.

The [source-noop outcome](WANTED_SOURCE_NOOP_OUTCOME.md) captured a real cold
checkout with matched target, transport connection and startup dispatch, but no
authentication or backend-ready response. A later healthy container probe could
not explain that original connection. This slice adds server evidence; it does
not change connection deadlines or claim to fix the unknown historical cause.

## Design

Only fresh default PostgreSQL 18 Alpine fixtures with server and checkout
diagnostics enabled receive connection-stage logging. Configure the owned
container at startup with JSON logging, English messages and verbose source
locations. Keep the existing health/listening wait strategy and resource bounds.
External, reused, custom and unsupported containers retain their configuration.
The logging collector redirects database stderr to temporary files; ordinary
Docker log visibility changes. Read/output bounds do not cap the file's lifetime
growth. The owned container's cleanup removes that temporary output.

The reviewed owned pg client adapter adds a random private application marker
to an otherwise unnamed startup packet. Preserve explicitly named clients and
every authentication/database/session parameter. The marker, user and database
stay in a private capture context; published records select fixed fields only.
The adapter restores its original startup method/listeners and forwards the
original driver result or Error/null.

A separate read-only probe tails at most 64 KiB of the known JSON file in the
captured immutable container, with a two-second command bound. A pure policy
accepts at most 256 bounded structured records and the reviewed PostgreSQL source
locations for receipt, authentication, authorization and initial ready/setup.
It discards raw messages, names, addresses, query text and credentials after
classification. A unique authorization marker plus current user/database binds
one server PID/session pair; only that pair's ordered records can describe the
original client. Duplicate/ambiguous evidence declines a match. Malformed or
partial rows are excluded and mark the window clipped; only complete recognized
records can associate a session within that window, not certify full history.

An earliest receipt may precede parsing of the marker. Docker NAT also prevents
assuming equality of the client's socket tuple and the server's remote tuple.
Without a unique marker-bearing authorization, report an unassociated window,
never attribute another session's receipt/authentication to the failed client.
Server setup durations differ from client monotonic elapsed time and do not
establish causality, immutable authority or universal performance bounds.

Capture joins the existing failure completion before pool/container cleanup.
All probes settle before forwarding the original failure. Successful default
checkouts launch no extra probe; controlled native tests may explicitly capture
successful server stages. Log files grow during the owned container's lifetime;
read/output bounds are separate from disk growth and disappear with cleanup.

## Proof and alternatives

Use pure hostile/truncated/ambiguous record tests, exact command/ownership bounds,
Error/null preservation and native PostgreSQL 18 source/config/marker evidence.
Prove both app entrypoints and direct pools forward the same private context.
Include a controlled held startup which remains unassociated, a real authorized
server-ready failure, and explicit application-name preservation. Preserve
original resource bounds and failed cohorts.

Direct socket matching is cheap but unreliable across NAT. Free-text log parsing
is less structural. Broad continuous streaming costs more and retains more data.
The chosen failure-only structured window is bounded and supports explicit
unknown results. See [research](POSTGRES_STARTUP_SERVER_RESEARCH_2026_10.md) and
[outcome](POSTGRES_STARTUP_SERVER_OUTCOME.md).
