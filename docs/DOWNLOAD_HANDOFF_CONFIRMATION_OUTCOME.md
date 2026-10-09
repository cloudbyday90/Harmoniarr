# Attempt-owned download confirmation outcome

Recorded 8 October 2026 local / 9 October UTC. Implementation and validation are
complete. The accepted contract, alternatives, official standards and final
recommendation stack are in the separate
[design](DOWNLOAD_HANDOFF_CONFIRMATION_DESIGN.md). Exact supported-provider
sources and version/retention limits have their own
[research document](SLSKD_TRANSFER_CONFIRMATION_RESEARCH_2026_10.md).

## Delivered design

New ESM modules own the private attempt/receipt policy, database checkpoint and
confirmation transaction, bounded older-run worklist and execution API projection.
The worker delegates receipt acceptance instead of independently linking and
advancing candidates. It is smaller than the previous implementation.

Preparation saves one immutable source/manifest and local UUID before POST.
Insert-only initialization and attempt comparison preserve another worker's
checkpoint. Cross-run unresolved ownership is checked under the candidate lock.
Final dispatch checks require an active owning run, a current finite lease,
interruption/maintenance checks and unchanged physical/recovery evidence.
Known non-dispatch remains stopped; it is distinct from uncertain acceptance.

Direct receipts require unique provider GUIDs, exact peer/file/positive safe size
and the supported download direction when supplied. Malformed/conflicting alias
envelopes and contradictory receipts retain no arbitrary first identity. Valid
partial receipts remain private and unresolved. History matching no longer proves
acceptance. Full confirmation links identities, advances the unchanged candidate,
records its accepted observation and writes required audit atomically. A link or
audit conflict rolls back that transaction.

Already accepted work is observed by its exact receipt IDs and body identity.
Missing, duplicate or subset observations cannot claim whole-request completion.
Current-attempt provenance guards also apply to later generic/manual progress;
completion callbacks, activity and automatic add follow an actual phase write.
Legacy confirmed-item grace behavior remains a separate compatibility path.

Unresolved manual/legacy checkpoints survive global and per-type pruning,
including terminal jobs. Older unresolved runs remain available to the heartbeat
through a bounded worklist rather than being hidden by a newer allocation.
Canonical Needs help/review guidance and legacy Start eligibility agree with
pending confirmation. Background refresh does not create a new download intent.
New attempt/manifest/receipt evidence is stripped from execution API extensions
and private canonical read facts are omitted from public evidence.
Existing administrator diagnostic requested-file and enqueued-transfer fields
remain available; the new private containers are deliberately excluded.

## Fresh verification

Executed focused evidence: 59 provider-boundary tests; 20 worker cases;
three worklist cases; 12 reconciliation cases; 25 adjacent service,
heartbeat, link and notification cases; 19 retention unit cases; four retention
PostgreSQL cases; eight production read-projection PostgreSQL cases; seven initial
confirmation PostgreSQL cases followed by eight extended cases. The final
combined transaction/execution/positive-ingestion command passes 20 cases,
zero failures/skips. Additional owned checks pass 42 backend, 157 projection/server
and 247 client tests. The rebuilt browser command passes 26 cases with zero
failures/skips; six captures at 390, 800 and 1280 pixels in both themes were
inspected. Focused totals overlap later broad validation and
must not be added to it. ESM and copyright checks pass. The fresh dependency
security check reports zero vulnerabilities.

Complete `npm run validate` passes **8,960 tests**: 3,855 server, 4,350 client,
513 script and 242 integration, with zero failures or skips. Copyright, migration
policy, schema snapshot, ESM, Compose policies, all lint/test-hygiene checks and
both builds pass. The final separate security command also reports zero
vulnerabilities at every severity. No dependency or schema change was needed.
The full validation command passed on its first complete run; the focused
development failures below remain separately documented.

The actual local media image used by integration validation is
`harmoniarr-quality-fallback:local`, SHA-256
`f2c6462fed5144abc742c9428127bd1011c559d832b17e3774964364719fa8e2`.
The full log records ffprobe 8.0.1. Those media controls are existing pipeline
evidence, not live-provider acceptance or a new audio-quality guarantee.

All 169 local links in the 12 changed Markdown documents pass the staged link
check. Git whitespace checks pass after line-ending cleanup. The cleanup preserves
normalized source text, including intentional final-newline additions. Repository
and installed skill structure pass validation; all four skill files match by
SHA-256. Application source and tests remained frozen during full validation.

## Observed failures and corrections

- New lease controls initially reproduced actual dispatch gaps: absent
  identity and an invalid expiry could pass equality/date comparisons. Strict
  identity, state and finite-date checks pass those controls. Two later controls
  also reproduced expiry/replacement during an awaited final guard; a lease
  recheck immediately before POST closes those cases. All 20 worker tests pass.
- The new retention fixture omitted required `status_message`, causing two setup
  failures. The fixture supplies it; database constraints are unchanged. The two
  focused cases and original four-case command both pass after correction.
- The new reader positive control exposed an old recovery ancestor hiding actual
  newer accepted work. The bounded read now distinguishes a merely allocated job
  from exact newer receipt/physical proof. The complete eight-case file passes.
- Older notification fixtures treated a null update as success. They now return
  the updated item for successful writes, while a separate refused-write case
  proves no completion activity or notification. The focused file and original
  adjacent command pass with assertions retained.
- Browser setup first intercepted the wrong fetch layer, then used a strict text
  selector that matched two existing feedback surfaces. The fixture and selector
  are corrected; the final same-command 26-case rerun passes without product
  assertions being relaxed.
- Final peer review found a legacy awaiting item without a handoff object could
  throw during summary hydration. Optional access and a fail-closed unknown/live-null
  regression now pass the focused summary suite.

Executed logs are retained under the ignored
`.tmp/transfer-confirmation-2026-10/` and
`.tmp/download-handoff-confirmation-2026-10/` directories. They are local execution
artifacts, separate from the committed documents and source. Separate original
lease, retention and adjacent-service failure logs are retained. Initial reader
and browser logs were overwritten by passing reruns; their original failures are
documented above and in tool/conversation evidence, not archived raw artifacts.

## PR and skill outcome

Fresh GitHub MCP discovery found the same three open patches already implemented
locally. The eligible unreplayed set is empty, so no random replay or merge was
applicable. Exact collection boundaries, hashes and prior implementation evidence
are in separate [PR design](OPEN_PR_APPLICABILITY_TRANSFER_CONFIRMATION_2026_10_DESIGN.md)
and [PR outcome](OPEN_PR_APPLICABILITY_TRANSFER_CONFIRMATION_2026_10_OUTCOME.md).

The existing practical web-standards AI skill now maps provider-version research,
caller-owned receipts, partial/current evidence, privacy and retention to owners
and adverse cases. Its separate [design](WEB_STANDARDS_SKILL_DESIGN.md) and
[outcome](WEB_STANDARDS_SKILL_OUTCOME.md) record this narrow maintenance; no fresh
blind skill trial or platform conformance certification is claimed.

## Limits and next recommendation

An explicit enqueue receipt establishes slskd local admission, not remote-peer
acceptance, downloaded bytes, audio quality or library completion. Lost legacy
responses without durable receipts remain unresolved. Provider restart can
replace an ID; disappearance does not prove a request was never applied.
The username list omits removed rows even when its caller asks for removal history.
New attempt-owned missing observations remain pending rather than triggering an
orphan retry. No live Soulseek/provider contact, provider restart or storage-loss
experiment was performed.

If another run is allocated after a POST starts, the old receipt remains durable
but current-origin phase guards leave the conflict in review. This does not
redesign every downstream origin rule or generic lease renewal/release fencing.
Unit stores are distinct from real PostgreSQL controls; browser DOM/focus evidence
does not establish screen-reader announcements or whole WCAG conformance.

Next: explicitly evaluate support for slskd 0.26 caller-ID batches, with exact
per-file batch ownership, known-receipt detail reads for removed transfers,
incomplete-batch handling and an operator resolution contract for old uncertainty.
Batch existence alone is insufficient. Keep the pinned 0.25.1 deployment for this
commit. Work stays on main with no release, tag, new branch or PR merge.
