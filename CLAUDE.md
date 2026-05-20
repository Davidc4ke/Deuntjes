# CLAUDE.md

Operating notes for Claude working on this repo.

## When you finish a testable change, tell the user what to test.

After every commit that produces user-visible behavior, end the turn with a short **"Test this"** section that lists:

- The URL/path to open (prod URL if deployed, else local route)
- The exact action(s) to perform
- The expected outcome — what they should see or what should *not* happen
- Any known-stub paths to avoid (so they don't report "broken" on things that aren't built yet)

Format:

```
**Test this**
- Open https://<host>/<path>
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
- `main` branch auto-deploys
- Public URL: https://web-production-cb956.up.railway.app
- Healthcheck: `/api/healthz`
- Workspace API key is configured in the chat with the user

## Conventions

- Tickets are tracked as GitHub issues #1–#6 with explicit dependencies
- Develop on `claude/<topic>-<id>` branches; ask before merging to `main`
- Passwordless login: usernames in `users.seed.json` are the entire access list
- No PRs unless the user asks
