#!/usr/bin/env bash
ROOT=/workspaces/lumen-workspace
cd "$ROOT"

echo "1/4 Starting database and Redis..."
docker compose up -d
until docker compose exec -T db pg_isready -U lumen >/dev/null 2>&1; do sleep 1; done
echo "    Postgres is ready"

echo "2/4 Stopping old servers..."
pkill -9 -f uvicorn 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f next-server 2>/dev/null
sleep 1

echo "3/4 Starting backend (8000) and frontend (3000)..."
(cd "$ROOT/api" && source .venv/bin/activate && nohup uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 > /tmp/api.log 2>&1 &)
(cd "$ROOT/web/lumen-fe" && nohup pnpm dev -H 0.0.0.0 > /tmp/web.log 2>&1 &)
sleep 6

echo "4/4 Making ports public..."
gh codespace ports visibility 8000:public 3000:public -c "$CODESPACE_NAME" || echo "Set ports public in the Ports tab"

echo
curl -s localhost:8000/health && echo "  <- backend OK" || echo "Backend not up yet: tail -20 /tmp/api.log"
echo "App:  https://${CODESPACE_NAME}-3000.app.github.dev"
echo "API:  https://${CODESPACE_NAME}-8000.app.github.dev/docs"
