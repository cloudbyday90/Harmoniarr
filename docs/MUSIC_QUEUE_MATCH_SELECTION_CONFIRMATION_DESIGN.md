# Music Queue Match Selection Confirmation Design

Date: 2026-08-25

## Decision

Require an explicit, plain confirmation after an operator chooses **Use this
match** and before the existing authenticated selection mutation runs. Keep
the confirmation inside the current Music Queue review context; do not add a
checkbox, navigate to Downloader, or submit a provider request from the
client.

## Finding

Choosing a reviewed match is a consequential but reversible operator decision:
it changes the release's selected candidate and can allow the existing
background workflow to queue download work after its checks finish. The action
previously sent the mutation immediately, so the page did not provide a final
opportunity to cancel after reading the candidate evidence.

The product already provides a shared native dialog host with labelled actions,
modal focus handling, Escape/backdrop cancellation, and return-to-trigger
behavior. Reusing it keeps the experience consistent with the library-add
confirmation while avoiding a new singleton or one-off modal.

## Official sources reviewed

- [W3C WAI-ARIA Authoring Practices: Modal Dialog](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
  describes the modal containment, visible close action, labelled dialog, and
  focus expectations used by the existing shared dialog.
- [W3C WCAG 2.2: Pointer Cancellation](https://www.w3.org/TR/wcag/#pointer-cancellation)
  permits a confirmation flow that offers a way to abort before the action
  completes. The selection mutation starts only after the second explicit
  activation.
- [W3C WCAG 2.2: Label in Name](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name)
  recommends that visible control text is included in its accessible name. The
  dialog title and primary button both begin with **Use this match**.
- [Playwright locators](https://playwright.dev/docs/locators) recommends
  role- and accessible-name-based assertions; browser coverage uses the
  `alertdialog` and button names users encounter.

## Options

| Option | Pros | Cons | Decision |
| --- | --- | --- | --- |
| Keep immediate selection | One activation | Offers no final cancel point before download-related work may proceed | Rejected |
| Plain confirm/cancel dialog | Clear consequence, one deliberate second activation, no unnecessary form field | Adds one brief step for an intentional choice | Chosen |
| Checkbox or typed acknowledgement | Stronger friction | Redundant for a reversible, reviewed selection; increases cognitive and keyboard work | Rejected |
| Redirect to Downloader first | Exposes later progress | Breaks the review task and still does not improve choice confirmation | Rejected |

## Final stack

- New framework-free ESM presentation module:
  `src/client/lib/music-queue-match-selection-confirmation-presentation.js`
- Existing shared `useConfirm()` service and native `<dialog>` host
- Existing release-scoped action feedback and focus-recovery composables
- Client copy tests and browser tests for cancel, confirmation, and focus

## Security boundary

The change adds no API route, provider capability, external network request,
or persistent client secret. The existing selection route retains fresh-session
authentication, CSRF validation, rate limiting, and scoped idempotency. The
confirmation copy neither exposes provider identity nor claims that a provider
has accepted a transfer.
