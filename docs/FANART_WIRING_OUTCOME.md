# Fanart.tv composition and album ownership outcome

Completed October 22, 2026 on `main`. See the separate
[design](FANART_WIRING_DESIGN.md), [research and alternatives](FANART_WIRING_RESEARCH.md)
and [Docker outcome](LOCAL_DOCKER_FANART_WIRING_OUTCOME.md).

## Result

The application now supplies the same provider credentials service to settings
and artwork. The default artwork client resolves stored project/personal keys
per logical request, preserving environment fallback after clearing and private
failure before dispatch. Explicit client overrides remain authoritative.

Image selection lives in its own ESM module. Current v3.2 album arrays and legacy
maps select the requested release group even when another album appears first
and has more likes. Missing, duplicate, conflicting or malformed nested target
identity is a typed failure before download/ingestion/assignment. Empty albums
and flat endpoint compatibility remain supported; a refused nested envelope
cannot fall back to top-level artwork. Artist image type/language/likes priority
is preserved, and malformed image entries are ignored safely. The touched artwork
module's pre-existing mixed line endings were normalized to LF.

## Evidence

| Check | Result |
| --- | --- |
| Focused credentials, composition, selection, transport, settings and artwork checks | 71 passed |
| `npm run validate:fast` | 10,884 passed: server 5,717; client 4,470; scripts 697 |
| Shared providers, Last.fm, MusicBrainz and Fanart.tv native HTTPS | 18 passed on Windows in the fast gate; 18 passed serially in isolated Linux |
| Built client comparison | All 155 artifacts unchanged |
| Packaged ESM probe | Actual packaged module/client/credential service passed rotation, clear, nested selection and private refusal |
| Skill validators and local documentation links | Passed |

The app construction test establishes shared dependency identity. The fixture
uses real credentials mutation/resolution, artwork-module client construction and
the real artwork consumer with controlled persistence, image and assignment
sinks. Native HTTPS preserves the default provider URL, Host/SNI and TLS verifier,
and observes synthetic keys only in headers. A compressed multi-album response
produces three target-owned assignments across saved/rotated/cleared credentials;
the next mismatched response and subsequent credential failure produce no further
download or assignment. The credential failure produces no HTTP request.

Linux used the exact candidate image with its Linux production dependencies,
read-only source/test mounts, UID 1000, no external network, one CPU, 256 MB memory
and a 16 MB temporary filesystem. Its owned container was removed and absence
verified. A separate isolated probe imported actual packaged ESM modules directly.
This establishes tested composition and ordering, not durable PostgreSQL writes,
live provider availability, real image content or every catalogue shape.

Nine changed/new code files remained frozen through validation and packaging.
The tested source fingerprint covers 3,280 files:
`f6c75244eab36c119d7d357e675ceb683ad63d8db899ccf1f5ad4b14e1a7f41c`.
Private logs, code hashes and artifact inventories are under ignored
`.tmp/fanart-wiring-2026-10-22/`. No SQL, dependencies, client UI, release version
or tags changed. Unrelated database/browser matrices were not repeated.

An initial lint check caught a duplicate import/re-export declaration; it was
corrected before the passing focused/fast runs. Private evidence-helper setup
also needed a Python syntax correction; it changed no production semantics. The
final source, built artifacts and staged code hashes were checked separately.

GitHub MCP returned zero open PRs at selection and completion. No random PR could
be selected; no PR was merged, closed or rebased.

## Recommendation and next item

Retain existing encrypted secrets → shared composition → fresh header resolution
→ bounded native HTTPS JSON → pure target-bound selection → artwork ingestion
and assignment. This supplies immediate saved-key changes and prevents foreign
album assignment at the cost of secret reads and explicit schema refusals.
Separate key callbacks do not guarantee an atomic two-key snapshot; clearing a
stored key intentionally restores its environment fallback rather than revoking
that external credential.

**Next: contain the default image downloader.** It still calls `fetch(url)` and
buffers the entire image without its own origin/redirect/decoded-byte policy.
Design provider-aware URL admission, redirect handling, deadline/body retirement,
encoded/decoded image budgets and format checks, then prove refusal before
ingestion and assignment with the owned native fixture. Keep Cover Art Archive
and TheAudioDB compatibility explicit. Current metadata bounds and target checks
do not establish general SSRF resistance or safe live artwork ingestion.
