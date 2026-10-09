# lumen-workspace
echo $CODESPACE_NAME
gh codespace ports visibility 8000:public -c "$CODESPACE_NAME"
// run fastapi 
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Run frontend
pnpm dev -H 0.0.0.0