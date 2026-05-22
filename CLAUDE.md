# CLAUDE.md

Operating notes for Claude working on this repo.

## When you finish a testable change, tell the user what to test.

Current work is on a **static HTML mockup** under `public/mockups/`. The user opens the file directly in a browser — there's no Railway preview, no build step, no server-side anything. Don't tell them to wait for Railway or open a preview URL.

After every commit that produces user-visible behavior, end the turn with a short **"Test this"** section that lists:

- The mockup path to open (e.g. `public/mockups/sequencer-sandbox.html`)
- The exact action(s) to perform
- The expected outcome — what they should see or what should *not* happen
- Any known-stub paths to avoid (so they don't report "broken" on things that aren't built yet)

Format:

```
**Test this**
- Open `public/mockups/<file>.html`
- Do <action>
- Expect: <observable outcome>
- Stubs (not built yet): <list>
```

Skip the section only when the change is purely internal (refactor, dependency bump, infra-only) with no observable behavior change. In that case say "no user-visible change" instead.

## Project layout

- `src/app/` — Next.js App Router pages + API routes
- `src/components/` — UI components (`app/`, `song/`, `social/`, `editors/`, `shared/`)
- `src/db/schema.ts` — Drizzle schema (single source of truth)
- `src/db/migrate.ts` — runs on container start
- `src/storage/` — `StorageAdapter` interface; LocalVolumeStorage today, R2 later
- `src/scripts/seed-users.ts` — idempotent user upsert, runs on container start if `users.seed.json` exists
- `scripts/start.sh` — Railway container entrypoint: migrate → seed → start
- `architecture.md` (the original brief, kept in chat) — authoritative design doc

## Deploy

- Railway project `Deuntjes`, region `europe-west4-drams3a`
- `main` branch auto-deploys to prod: https://web-production-cb956.up.railway.app
- **Open PRs get their own Railway preview env** — that's where you and the user verify changes for a branch before merging. Each push to the PR branch rebuilds the preview (~1-2 min).
- Healthcheck: `/api/healthz`
- Workspace API key is configured in the chat with the user

## Branching workflow

- **`main` is the only long-lived branch** and is the GitHub default. Pushes to `main` deploy to prod.
- For each ticket, develop on a `claude/<topic>-<id>` branch.
- After pushing the topic branch, **open a PR** (if one doesn't already exist for the branch) so Railway spins up a preview env the user can test against. Use `gh pr view` / the GitHub MCP tools to check whether a PR already exists before creating one.
- Point the "Test this" section at the PR preview URL, not the prod URL.
- Merge happens **after the user verifies on the preview**. Default to a merge-commit PR merge (matches the existing history); the user may merge themselves or ask you to.
- Delete the topic branch after merge.

## Conventions

- Tickets are tracked as GitHub issues #1–#6 with explicit dependencies
- Passwordless login: usernames in `users.seed.json` are the entire access list
