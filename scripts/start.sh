#!/bin/sh
set -e
echo "[deuntjes] running migrations…"
pnpm db:migrate
if [ -f users.seed.json ]; then
  echo "[deuntjes] seeding users…"
  pnpm seed:users || echo "[deuntjes] seed failed (continuing)"
fi
echo "[deuntjes] starting next…"
exec pnpm start
