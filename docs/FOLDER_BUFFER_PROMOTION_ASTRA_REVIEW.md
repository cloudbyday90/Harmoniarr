# Astra review of buffer promotion

November 14, 2026. The user explicitly requested Astra's review. Astra inspected
the existing service, selector/cursor, benchmark, package, tests and applicable
architecture/validation instructions without editing files. This document records
its recommendations and the implementation decisions; executed evidence belongs
in the [outcome](FOLDER_BUFFER_PROMOTION_OUTCOME.md).

Astra supports a narrow fixed-128 promotion. Keep the buffer server-owned; a
local named constant is sufficient. The shared page/cursor policy is not the
owner of native I/O buffering. Experimental 32/128 variants must remain independent
and the default stream/32 algorithm comparison must be labeled historical.

Its main gap finding was real long/Unicode paging. Include byte-bounded long
common prefixes, NFC/NFD pairs and supplementary characters, with full forward
exhaustion, reverse navigation, exact path/name identity and boundary anchors.
The final qualification will also exercise four long-name ceiling scans on one
service/process. Preserve filesystem forms and ordinal order; do not normalize
user data. Valid Unicode tests do not establish arbitrary non-UTF-8 POSIX support.

Keep page 100, raw ceiling 50,000, admission four and the cooperative five-second
deadline. Qualify the matching immutable package and actual native success,
overflow, cancellation, fifth refusal and capacity reuse. A delayed read delivery
is a controlled ownership boundary, not evidence of kernel I/O interruption.

Astra noted that the existing service releases admission after close settlement
even if close rejects. Successful close proves retirement; rejection alone does
not. This pre-existing behavior is not a buffer-promotion regression and is not
expanded into a lifecycle redesign here. Qualification must distinguish these
claims and retain refused/slow observations.

For random PR #61, Astra identified the existing guarded native parser suite's
exact version assertions/diagnostics and tokenizer pin. Refresh actual parsing
and projection for FLAC/MP3/Opus/WAV/M4A, unsupported bytes and header-only FLAC.
Add real parsed embedded-cover selection because production also consumes
selectCover. A controlled writer does not prove SQL persistence. Changed parser
evidence must be refreshed rather than described as unchanged runtime proof.

Accepted recommendation stack: focused service/profile/parser tests, stable source
and lock hashes, one complete fast gate, fresh packaged native controls and local
profiles, scoped retention of unrelated evidence, and verified cleanup. Preserve
the stopped walkthrough and its data/settings; qualification does not require
rolling out the candidate or introducing a permanent extra application service.

Astra also assessed the newly discovered November 11 Node security release.
Production uses ordinary HTTP; no production HTTP/2 or TLS-server entry was found.
Inspected outbound transports use fresh fixed-policy agents or agent:false.
No application exploit path was demonstrated; this does not establish immunity.
Preserve the frozen buffer result and make coordinated 24.22.3 qualification the
highest-priority next change before rollout.
[Official advisory](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases/).

That patch must align .nvmrc, package/lock engine floors, verified Docker digest,
benchmark version assertion, manual signal regex/assertions and the separate
canonical-media image. Refresh packaged HTTP/provider/PostgreSQL TLS, parser,
folder and native signal evidence; rerun buffer measurements before claiming
performance on the new runtime. A version-string change alone is insufficient.
