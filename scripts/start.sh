#!/bin/sh
set -e
echo "[deuntjes] running migrations…"
pnpm db:migrate
echo "[deuntjes] starting next…"
exec pnpm start
