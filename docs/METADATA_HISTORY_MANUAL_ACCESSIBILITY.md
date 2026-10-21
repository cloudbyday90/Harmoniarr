# Metadata history manual accessibility acceptance

Status: procedure prepared October 21, 2026; a real screen-reader/device session
has not been executed by this automation. Automated engine, focus and zoom
evidence is recorded separately in the [compatibility outcome](METADATA_HISTORY_COMPATIBILITY_OUTCOME.md).

## Preparation and evidence

For a repeatable desktop session, run `npm run manual:metadata-history` with
local Docker Engine 28+ available. Open the printed bootstrap URL in a new private window of the
browser paired with your screen reader. Create a disposable account using test
credentials, then open the printed artist URL. The real application uses three
synthetic history pages (10 initial, 10 continuing, one final) in a fresh database.
The terminal accepts `status`, `hold`, `release`, `fail`, `reset` and `quit`.
`hold` arms the next page read; activate Load more, observe pending feedback, move
to Artist name, then use `release`. A facilitator can operate the terminal while
the evaluator keeps working in the browser. `fail` rejects a held or next read
once, so the same paging button can retry the unchanged cursor. `reset` requires
no held read and a browser reload to restore initial content. Quit/EOF/Ctrl+C
retire the owned session; close the private window afterward.

This fixture serves only an allowlist on host loopback and refuses provider
search/mutation routes. Terminal controls have no HTTP endpoints. Other app
pages may report refusal because they are outside this assessment. It cannot
be reached from a phone; physical-device checks below need their own test
environment. See the [fixture design](METADATA_HISTORY_MANUAL_FIXTURE_DESIGN.md)
and [qualification outcome](METADATA_HISTORY_MANUAL_FIXTURE_OUTCOME.md).

Use a test account and a Metadata artist with enough recorded events for at
least three pages, so continuing and final completions can both be exercised.
Keep real searches/imports/downloads outside this read-only
history assessment. The preserved local Docker walkthrough is suitable when it
already contains that history; otherwise record the prerequisite as unavailable
rather than manufacturing production events. Use a disposable fixture environment
when creating test history. Never use a personal browser profile in automation.

Record date, OS, browser/version, assistive technology/version, viewport and zoom,
theme, input method, and whether a nonzero safe area was actually observed.
Keep speech recordings and artist/account details private. Publish reviewed
pass/fail counts, the failed step and an actionable reproduction. An unperformed
step is not a pass. Playwright WebKit on Windows is not a Safari/device substitute.

## Screen reader and keyboard

1. Enable the chosen screen reader and open the artist's Recent discoveries
   section. Confirm its heading and each event's label/value relationships make
   sense in reading order. Check time, decision and resulting Wanted status.
2. Reach Load more history with the keyboard. Activate it with Enter. Observe
   the busy control and confirm the history loading/result messages are conveyed
   without requiring focus on the status container. Record actual speech rather
   than requiring particular synthesized punctuation or voice phrasing.
3. On a continuing page, confirm the button retains keyboard focus and is fully
   visible with its focus indicator. Read the newly appended content through
   ordinary screen-reader navigation; check that the count describes this page.
4. On the final page, confirm focus moves to the surviving Recent discoveries
   heading, that completion is conveyed, and the paging control is removed.
5. If a genuinely pending read can be held in a disposable fixture or through
   controlled network conditions, move to Artist name before completion. Confirm
   completion preserves that focus and reading position. Record unavailable if
   there was no actual pending window. Do not infer this check from a fast click.
6. If a controlled failure is available, confirm bounded error feedback and an
   explicit retry, without an unsolicited provider command. Otherwise mark the
   failure/retry check unperformed; never disrupt the real provider to create it.

## Browser zoom and device clearance

Use the actual desktop browser zoom control at 400%, starting from a 1280x1024
content viewport. Record the effective CSS viewport. Check ordinary vertical
reading, visible controls and all event content without horizontal clipping or
loss. Test both continuing-button and final-heading focus. A 320-pixel viewport,
CSS zoom or device-scale emulation alone is not this manual browser-zoom check.

On a real small-screen device, repeat the visible-control checks above its fixed
bottom navigation and home-indicator region. Record the actual safe-area value;
do not count an emulated device name or injected CSS spacing as hardware proof.
Exercise the on-screen keyboard while reading/returning to Artist name, then
check focus remains with that field after a pending completion where available.

Choose a supported browser/AT pairing available to the operator, such as a
Windows screen reader with Firefox or VoiceOver with Safari on an owned Apple
device. These are examples, not claims that those sessions passed. Use the
[official research](METADATA_HISTORY_COMPATIBILITY_RESEARCH_2026_10.md) to keep
normative criteria, informative techniques and project conventions distinct.
