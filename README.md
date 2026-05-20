# Deuntjes

Private songwriting for 3-4 friends across time zones. Mobile-first, async-first, mix-and-match.

See `architecture.md` (in the original brief) for the full design. Build progress is tracked in GitHub issues #1–#6.

## Local dev

```bash
pnpm install
cp .env.example .env.local           # fill in DATABASE_URL, NEXTAUTH_SECRET
pnpm db:generate                     # generate SQL from schema
pnpm db:migrate                      # apply to your local Postgres
cp users.seed.example.json users.seed.json   # edit passwords
pnpm seed:users
pnpm dev
```

## Deploy (Railway)

- Postgres add-on attached as `DATABASE_URL`
- Volume mounted at `/data`, env `STORAGE_PATH=/data`
- `NEXTAUTH_SECRET` (openssl rand -base64 32), `NEXTAUTH_URL` set to the public URL
- Migrations run automatically on container start (see `scripts/start.sh`)

## What ships in this foundation (#1)

- Next.js + TypeScript scaffold, TanStack Query + Zustand + Tone.js installed
- Full Drizzle schema for songs, versions, sections, drum kits, slots, takes, mixes, reactions, comments, activities, read state
- NextAuth credentials + bcrypt, `pnpm seed:users` CLI
- Mobile shell: `AppBar`, `FloatingTransport`, `ContextBar`, `BottomSheet`, viewport-fit + safe-area
- `StorageAdapter` + `LocalVolumeStorage` writing under `STORAGE_PATH`
- Auth-gated `/api/files/[...path]`
- PWA manifest + icon
- Railway Dockerfile + healthcheck
