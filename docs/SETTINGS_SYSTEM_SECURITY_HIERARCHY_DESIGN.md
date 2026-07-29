# Settings System & Security Hierarchy

## Status

Implemented on 2026-07-28.

## Problem

System & security hid its security controls beside ordinary Base URL and logging
settings, without showing what the saved configuration meant. A local operator
could not distinguish the intentional local HTTP default from an incomplete
remote HTTPS setup, and an operator configuring remote access had to infer the
relationship between the URL, HTTPS enforcement, secure cookies, and CSRF.

## Research

Sources were checked on 2026-07-28 against the requested June 2026 baseline.

| Source | Applied guidance |
| --- | --- |
| [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Treat Secure, HttpOnly, and SameSite cookie properties as important session controls and avoid over-claiming their protection. |
| [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Present CSRF as a distinct server-side protection; SameSite behavior is defense in depth, not a replacement. |
| [W3C WCAG 2.2 Focus Order](https://www.w3.org/WAI/WCAG22/Understanding/focus-order.html) | Keep posture, remote-access controls, and advanced controls in the same visual and keyboard order. |
| [W3C ARIA Disclosure Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) | Keep uncommon Base URL and logging settings behind a semantic, keyboard-operable disclosure. |

## Options Considered

| Option | Pros | Cons |
| --- | --- | --- |
| Keep both control groups hidden | Compact | Gives no clear security posture and hides primary remote-access controls. |
| Infer live proxy and certificate health in the client | Could be reassuring | Client settings cannot reliably prove deployment topology, proxy headers, certificates, or network exposure. |
| Saved-configuration posture, visible remote controls, advanced system disclosure | Makes the local default and incomplete HTTPS state clear without making unsafe runtime claims | Requires operators to open one disclosure for Base URL/logging. |

## Final Recommendation Stack

1. Show **Security configuration** first, derived only from saved settings.
2. Explicitly state that the summary does not test reverse-proxy, certificate, or network reachability.
3. Keep **Remote access protections** visible: secure cookies, HTTPS enforcement, HSTS, and CSRF mode stay together.
4. Put Base URL and logging in **Advanced system controls**.
5. Preserve server-authoritative validation, CSRF enforcement, session handling, and the separately protected local admin-recovery flow.

## Implementation

- Added the pure ESM `settings-security-presentation.js` helper, which reports local HTTP configuration, incomplete remote HTTPS configuration, or complete saved HTTPS configuration.
- Added a posture card with textual status and per-control labels. It does not claim that a proxy or certificate is healthy.
- Promoted remote-access protections from a hidden disclosure to a direct card.
- Renamed and retained Base URL/logging as a single advanced disclosure.

## Security Boundaries

- The browser never decides whether a deployment is actually Internet-accessible or whether a TLS certificate is valid.
- Server settings validation and runtime middleware remain authoritative.
- This work does not change session cookies, HTTPS redirects, HSTS headers, CSRF behavior, authorization, or recovery routes.
- Bootstrap-admin recovery remains a locally armed, separately audited workflow; this screen does not expose recovery secrets or introduce remote recovery control.

## Verification

- Pure helper tests cover local, incomplete remote, and saved HTTPS-ready configurations.
- Browser verification proves the posture card leads the route and that Base URL appears only after opening Advanced system controls.
- Full test/build/ESM checks and a no-cache walkthrough rebuild are required before release.

## Next Item

Review **Settings > Users & access**: prioritize active access posture and common account actions, then move provisioning, claims, password recovery, and linked-account maintenance behind task-specific disclosures.
