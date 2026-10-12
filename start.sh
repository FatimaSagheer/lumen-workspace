#!/usr/bin/env bash
# One command to set up and start the whole Lumen stack:   ./start.sh
# It is safe to run again and again. Stop everything with: ./stop.sh
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT" || exit 1

say() { printf '\n== %s\n' "$*"; }

# Where the browser will find the API
if [ -n "${CODESPACE_NAME:-}" ]; then
  API_URL="https://${CODESPACE_NAME}-8000.app.github.dev"
  APP_URL="https://${CODESPACE_NAME}-3000.app.github.dev"
else
  API_URL="http://localhost:8000"
  APP_URL="http://localhost:3000"
fi

# ---------- 1. Setup (each part is skipped when it is already done) ----------
say "Checking setup"

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
  echo "created .env with a fresh JWT secret"
fi

if [ ! -x api/.venv/bin/uvicorn ]; then
  echo "installing backend packages (first time only)..."
  (cd api && python -m venv .venv && . .venv/bin/activate && pip install -q -r requirements.txt) \
    || { echo "backend install failed"; exit 1; }
fi

if [ ! -d web/lumen-fe/node_modules ]; then
  echo "installing frontend packages (first time only)..."
  (cd web/lumen-fe && pnpm install) || { echo "frontend install failed"; exit 1; }
fi

# Always rewrite this one, because a new Codespace has a new name
echo "NEXT_PUBLIC_API_URL=${API_URL}" > web/lumen-fe/.env.local

# ---------- 2. Stop anything left over ----------
say "Stopping old servers"
fuser -k -9 8000/tcp >/dev/null 2>&1
pkill -9 -f "next dev" >/dev/null 2>&1
pkill -9 -f next-server >/dev/null 2>&1
sleep 1

# ---------- 3. Database ----------
say "Starting the database"
if ! docker compose up -d >/dev/null 2>&1; then
  echo "docker was in a stale state, resetting the containers (your data is kept)..."
  docker compose down >/dev/null 2>&1
  docker compose up -d || { echo "docker failed to start"; exit 1; }
fi

# -h 127.0.0.1 waits for the REAL server, not the temporary one used during first setup
tries=0
until docker compose exec -T db pg_isready -h 127.0.0.1 -U lumen >/dev/null 2>&1; do
  tries=$((tries + 1))
  if [ "$tries" -gt 60 ]; then echo "database did not become ready"; exit 1; fi
  sleep 1
done
echo "database ready"

# ---------- 4. Backend and frontend (in the background) ----------
say "Starting the backend and the frontend"
(cd api && . .venv/bin/activate && nohup uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/api.log 2>&1 &)
(cd web/lumen-fe && nohup pnpm dev -H 0.0.0.0 > /tmp/web.log 2>&1 &)

for _ in $(seq 1 40); do
  curl -sf localhost:8000/health >/dev/null 2>&1 && break
  sleep 1
done
for _ in $(seq 1 40); do
  curl -s -o /dev/null localhost:3000 2>/dev/null && break
  sleep 1
done

if curl -sf localhost:8000/health >/dev/null 2>&1; then
  echo "backend OK"
else
  echo "backend NOT up. Read the reason with: tail -30 /tmp/api.log"
fi

# ---------- 5. Ports ----------
if [ -n "${CODESPACE_NAME:-}" ]; then
  gh codespace ports visibility 8000:public 3000:public -c "$CODESPACE_NAME" >/dev/null 2>&1 \
    || echo "could not make the ports public, set them in the Ports tab"
fi

# ---------- 6. A development login, so a fresh database is not empty ----------
# (409 means it already exists, which is fine. Development only.)
curl -s -o /dev/null -X POST localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"fatima@test.com","password":"password123","name":"Fatima"}'

say "Ready"
echo "App:    ${APP_URL}"
echo "Login:  fatima@test.com / password123"
echo "Logs:   tail -f /tmp/api.log /tmp/web.log"