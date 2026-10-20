# slskd 0.26.1 qualification design

Consulted October 20, 2026. Extend the isolated native fixture before changing
production support. The released timeout fix cancels the download token after
three minutes; ordinary successful enqueue evidence does not exercise it.

Add a separate opt-in timeout lane. Withhold the first acknowledgment for one
declared file, keep the owned connection alive longer than the provider's
three-minute guard, then observe the original receipt reaching a terminal state.
Use the same fixture against 0.26.0 and 0.26.1. Submit one explicitly requested
new batch for the same filename after that boundary. Compare whether the old
internal transfer prevents it. Inspect 0.26.1's authenticated debug transfer list
as additional retirement evidence, not as a production integration dependency.

Keep commands short and bounded: the provider owns its asynchronous download;
the host performs read-only observations between completed Docker commands.
Preserve source fingerprints, exact version/image identity, internal-only
networking, generated file credentials and strict cleanup. The longer socket
bound and provider inactivity override apply only to this timeout lane. Never
shorten or patch the released binary's three-minute timeout.

Only after qualification, admit the exact observed 0.26.1.0 version, retaining
raw prepared-binding identity and refusing other unreviewed versions. Run the
existing direct/lost-response receipt lane against both images, plus affected
durable handoff tests. A fixture-initiated retry is not authorization for the
application to resend an uncertain POST.

The independently random PR is evaluated in its own document. No PR merge,
release, tag, application branch or operator-data reset is part of this work.
