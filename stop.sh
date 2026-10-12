#!/usr/bin/env bash
# Stops the backend, the frontend and the containers (your data is kept)
cd "$(dirname "$0")" || exit 1
fuser -k -9 8000/tcp >/dev/null 2>&1
pkill -9 -f "next dev" >/dev/null 2>&1
pkill -9 -f next-server >/dev/null 2>&1
docker compose stop
echo "stopped"