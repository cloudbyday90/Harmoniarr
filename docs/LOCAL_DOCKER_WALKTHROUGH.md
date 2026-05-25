# Harmoniarr Local Docker Walkthrough

This walkthrough gives you one disposable local Docker path for exploring the current app without hand-editing a host `.env` file or using the first-run bootstrap form manually.

It is intentionally separate from the canonical deployment baseline in `compose.yaml`.

## What It Does

- builds the local image from the current repository
- binds the app only to `127.0.0.1:47956`
- keeps all walkthrough data under `./.data/walkthrough/`
- uses the shipped public bootstrap route to create one local admin through a one-shot helper after the app becomes healthy

Local walkthrough credentials:

- username: `walkthrough-admin`
- password: `HarmoniarrLocal123!`

These credentials live in `docker/walkthrough.env` and are only meant for disposable local exploration.

## Optional: Last.fm API Key

To enable similar-artist recommendations in Discover, set the `LASTFM_API_KEY` environment variable before starting the stack. The key is free and unlimited — get one at https://www.last.fm/api/account/create.

```powershell
$env:LASTFM_API_KEY = "your-key-here"
docker compose -f compose.walkthrough.yaml build harmoniarr
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
```

## Start

From the repository root:

```powershell
docker compose -f compose.walkthrough.yaml build harmoniarr
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
docker compose -f compose.walkthrough.yaml --profile bootstrap run --rm --no-deps walkthrough-bootstrap
```

When the stack is ready, open:

```text
http://127.0.0.1:47956
```

The one-shot `walkthrough-bootstrap` helper exits successfully after creating the walkthrough admin. That is expected. Running it through `docker compose run --rm` keeps the normal walkthrough stack clean instead of leaving an exited helper container behind.

If you need a fully clean rebuild while testing Docker changes, use:

```powershell
docker compose -f compose.walkthrough.yaml build --no-cache harmoniarr
docker compose -f compose.walkthrough.yaml up -d --wait --no-build harmoniarr
docker compose -f compose.walkthrough.yaml --profile bootstrap run --rm --no-deps walkthrough-bootstrap
```

## Stop

```powershell
docker compose -f compose.walkthrough.yaml down --remove-orphans
```

## Reset

If you want a brand-new walkthrough state, stop the stack and remove the local walkthrough data directory:

```powershell
docker compose -f compose.walkthrough.yaml down --remove-orphans
Remove-Item -Recurse -Force .\.data\walkthrough
```

## Why This Exists

This walkthrough is for local exploration only.

- `compose.yaml` remains the canonical deployment baseline.
- the walkthrough keeps localhost-only port exposure and repo-local bind mounts so it is easy to throw away
- the bootstrap helper reuses the existing public route contract instead of introducing a second admin-seeding code path into the application runtime
- the helper is now explicit and disposable, so the walkthrough does not keep stale exited setup containers in the normal stack
