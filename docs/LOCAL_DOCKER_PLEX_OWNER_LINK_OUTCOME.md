# Plex owner-link Docker qualification outcome

October 27, 2026. See the [qualification design](LOCAL_DOCKER_PLEX_OWNER_LINK_DESIGN.md)
and [implementation outcome](PLEX_OWNER_LINK_OUTCOME.md).

## Frozen candidate and deployment

Source fingerprint: 3,770 files,
`7b555a366feb689a319d67c81216fc907768bc17524e2af08ff8313b7fcd4e4e`.
Twelve changed code/test files were frozen before the single fourteen-stage fast
gate: 6,323 server + 4,504 client + 703 script/policy tests = 11,530 passes, with
zero failures/skips/cancellations. Lint, ESM, copyright, schema/migration/anchor,
image/compose policy, hygiene and build checks passed. npm audit found zero
vulnerabilities.

Fresh pull/no-cache buildx image:
`sha256:cc894841a4c1d05555abf19a3e0117ae9e8e14f9e4798bebea2bfd90fc164224`.
The fresh builder was removed. Against prior image
`sha256:3b29143b8c0e65f855491e36d98562ff9d25885e93582cf8c2346f28954c980a`,
exact comparison found only the eight intended server source changes, including
four added modules. The image has 1,039 server, 156 client and 13 shared files;
client/shared bytes match the local build/source and unrelated packaged server
files match the prior image. Runtime/package provenance remains Node 24.22.1,
npm 12.0.2, OpenSSL 3.5.9, undici 7.30.1, PostgreSQL 18.6 and pg 8.23.1, with
110 npm and 151 OS package records unchanged.

The existing read-only UID-1000 walkthrough was recreated on loopback port 47956.
All five inspected bind sources, including its actual downloads override, were
preserved. Existing administrator login/readiness succeeded; the bootstrap helper
retired and temporary readiness password file was removed. Startup verified 115
applied migrations, zero pending and no migration execution.

## Affected packaged proof

Five fresh guarded native entries use the immutable image without implementation
overlays: owner linking (33 scenarios), Plex HTTPS (19), sign-in callback (19),
retention (14) and linked login (23). Each has one passing test with no skips or
cancellations. Real PostgreSQL ownership is exercised throughout. Provider
responses in owner-link/callback/retention/linked-login fixtures are controlled;
the HTTPS entry separately exercises actual native TLS, DNS and socket drainage.

Owner linking covers browser/purpose/expiry refusal, current account and exact
session checks after provider work, committed demotion after a real account-lock
wait, one concurrent consumer, stale independent flows, clear invalidation, exact
state replacement/cipher/revision/deletion, required audit rollback, suppressed
token insert/delete, final state/parent expiry, automatic owner-state retention,
precommit invisibility, maintenance blocking/insertion, pool/lock bounds, actual
backend disappearance after timeout and a real COMMIT with controlled lost
acknowledgement. The operation's tracked checkout count is zero during provider
work. Timeout refusal and actual backend retirement are asserted separately.

Chromium on the same image confirms Secure host-only HttpOnly Lax owner-binding
cookies, cross-site return while the Strict refresh cookie is absent, legitimate
success, another-browser refusal, older-tab refusal and replay without session
cookie replacement. The provider fixture receives no binding cookie. Its TLS
certificate exception is scoped to the disposable browser contexts; native TLS
verification remains enabled. The browser fixture exits zero and its exact
container/network and host/browser owners retire. Native fixtures also have exact
container removal/absence evidence.

Live walkthrough Chromium checks confirm existing administrator login, one
automatic no-store schema diagnostics request, 164 current anchors, preserved
focus and no horizontal mobile overflow. Desktop/mobile screenshots are reviewed.
No human screen-reader/physical-device or live provider account acceptance is
claimed.

## Retained evidence and fixture corrections

Unrelated password/KDF/session/media checks retain prior qualification because
their exact source/tests, dependencies and packaged implementations are unchanged.
Changed common cookie defaults, provider routing and retention scope are covered
by the repeated affected lanes. No production session issuance, encryption,
transaction owner, maintenance guard, schema, shared/client or dependency files
changed.

Private evidence resides under `.tmp/plex-owner-link-2026-10-27`: source/code
hashes, gate logs, immutable inventories, native measurements/retirement,
browser results/screenshots, final manifest and post-push verification. Two early
fixture revisions failed: a synthetic request lacked socket metadata, and a
maintenance wait observer matched the wrong SQL text. Both were corrected in the
fixture and their failure logs/retirement evidence retained. Later preflight and
final packaged results are distinct; failed runs are not counted as passes.

No release, tag, additional deployed service, separate branch or PR merge was
created. GitHub MCP found no open or Dependabot PRs to apply/rebase/close. The next
item is the remaining provider linking callback boundary described in the
implementation outcome.
