# slskd 0.26.2 local qualification design

October 27, 2026. Apply [PR #57](https://github.com/cloudbyday90/Harmoniarr/pull/57)
locally on main without merging. Official
[release notes](https://github.com/slskd/slskd/releases) include queue handling,
core API access-level changes and explicit opt-in for runtime memory dumps.

An image-tag bump alone would leave downloads refused: Harmoniarr admits exact
reviewed wire identities. Qualify `0.26.2.0` as batch protocol, preserving saved
binding identity, before-send validation and conservative unknown outcomes. Keep
`0.26.2`, other revisions, canaries and coerced values refused.

Extend the existing native fixture version allowlist and parameterize its selected
file/audio modes while preserving old defaults as controls. Execute batch,
completed-file, partial EOF/reset, resume, permanent refusal and audio-import
cohorts using the actual immutable provider image and frozen application source.
Keep the production API key readwrite, private provider API, existing renderer
and memory-dump defaults unchanged. No operator provider/account/data is used.

Use `/application` server state for readiness, matching the production client.
The first 0.26.2 attempt exposed the fixture's old `/server` read receiving 403.
Assert that refusal with the restricted key, and use the existing permitted
application summary rather than broadening credentials. The upstream
[access-level change](https://github.com/slskd/slskd/pull/1905) confirms the new
boundary. Requalify affected fixture paths after this change.

For internal retirement/default-setting evidence, the isolated 0.26.2 fixture
alone creates a separate temporary administrator observer key. A narrow helper
admits only GET `options` and `debug/transfers`; unreviewed paths are refused
before credential delivery. Download/search configurations receive only the
readwrite key. Production managed configuration remains unchanged. Assert that
the readwrite key cannot read server/options/debug endpoints, and remove the
observer secret with the owned fixture workspace after acknowledged teardown.

The fixture owns an internal-only network, no published ports, read-only roots,
UID 1000, bounded CPU/memory/PIDs and acknowledged temporary file volumes. Require
actual process/socket closure, exact project/container/network/volume absence
and temporary-secret cleanup. Record each lane separately.

The existing three-minute enqueue timeout/debug lane remains scoped to its old
0.26.0/0.26.1 controls. This change does not promote an untested debug role or claim
new three-minute timeout evidence. The selected completed/partial/recovery/audio
lanes establish their own executed behavior on 0.26.2.

See [outcome](SLSKD_0262_QUALIFICATION_OUTCOME.md) and
[research/options](POOL_SESSION_ADMISSION_RESEARCH.md).
