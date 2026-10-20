# Search response publication outcome

October 20, 2026. Implemented the [design](SLSKD_SEARCH_PUBLICATION_DESIGN.md)
and [researched recommendation stack](SLSKD_SEARCH_PUBLICATION_RESEARCH_2026_10.md)
directly on main. Polling moved out of import-candidate-service.js into a small
ESM service. Completion now grants one bounded publication allowance instead of
an immediate empty return. Queued/running exhaustion and unpublished bodies
raise a sanitized unavailable error before candidate transaction/audit. Final
empty results require finalization, zero counters and a confirming response read;
positive observed counts cannot regress into a zero grant. Observed failed or
cancelled searches refuse. Original read failures propagate.

External request discovery supplies its existing current-target/cancellation/
maintenance guard during waiting. Its locked persistence guard remains in place.
This prevents extra reads or candidate writes after observed cancellation;
in-flight provider reads retain their existing timeout and are not remotely
cancelled by this hook. Existing partial-body acceptance is preserved.

The opening-code controls reproduced both defects: late publication became zero
candidates and permanent unavailability succeeded. The final controls recover
the candidate and reject unavailability without opening a transaction. The 24
added fast tests cover publication on the last observation, response-endpoint
arrival, true finalized empty results, missing/invalid finalization, positive
and regressing counts, queued/running budgets, provider failure, original
Error/null, cancellation, bounded configuration and connected dispatch failure.
Unavailable results do not record successful no-match cooldown/exhaustion.

Final validation used Node 24.22.0/npm 12.0.2 on frozen non-Markdown source:
3,128 files, SHA-256
`9e99e16c6a149c49c2401402540200539bf8347ee13adc8d8c15f008c5849f05`.
The fast gate passed 10,646 tests: 5,559 server, 4,390 client and 697 scripts,
plus static checks, lint and builds. No tests skipped or cancelled. Server test
runner duration was 65.6 seconds; this is an observation, not a matched speedup.
The standards and testing skills passed their structural validators.

The unchanged native search-to-audio case passed in 74.2 seconds (75.7 seconds
including test-runner overhead), with no skip/cancellation. Against the rebuilt
[Docker image](LOCAL_DOCKER_SEARCH_PUBLICATION_OUTCOME.md), actual slskd 0.26.1
emitted two searches and accepted four compressed peer responses. Real ingestion
created four candidates; actual canonical commands/planners/workers completed
both media transfers. Valid WAV content passed inspection, required audit, apply
and catalogue scan. Corrupt equal-size content remained at source with no target
or catalogue entry. Native sockets and disposable fixture owners retired.

The deterministic controls reproduce the state/body ordering at the application
boundary. The native case qualifies the ordinary real provider path; it does
not force the provider's internal database race or establish its frequency.
Unrelated timeout/retry matrices and unchanged browser flows were not repeated.
There is no whole-suite performance or general standards/security certification
claim. Failed controls and the initial corrected fixture assumptions remain
private under .tmp/search-publication-2026-10-20/.

The existing [standards skill](../.agents/skills/harmoniarr-web-standards/SKILL.md)
now teaches the publication method alongside W3C provenance, OWASP error handling,
IETF interface errors and version-specific vendor/runtime evidence. Its testing
reference keeps fast ordering proof separate from native qualification.
[Random PR 48](OPEN_PR_48_SEARCH_PUBLICATION_EVALUATION.md) is unchanged and still
incompatible with the current language-server consumer; package/lock/installed
version applicability passed and retained candidate/control evidence was reused.
It remains open and unapplied.

Next: persist the accepted provider search binding and resume reads of that same
search after bounded unavailability or worker restart. Bind it to current target,
intent, provider configuration and expiry; preserve cancellation and transaction
guards. Prove no second search POST during continuation, with a separate explicit
new-search intent after expiry. This is the next architectural improvement over
raising polling limits or adding another queue system. No release, tag, new
branch or PR merge is created in this change.
