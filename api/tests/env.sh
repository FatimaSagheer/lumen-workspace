API=localhost:8000
tok() { curl -s -X POST $API/auth/$1 -H "Content-Type: application/json" -d "$2" | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])"; }
j() { python -c "import sys,json; print(json.load(sys.stdin)$1)"; }
T=$(tok login '{"email":"fatima@test.com","password":"password123"}')
WS=$(curl -s $API/auth/me -H "Authorization: Bearer $T" | j "['workspaces'][0]['id']")
DOC=$(curl -s $API/workspaces/$WS/documents -H "Authorization: Bearer $T" | j "[0]['id']")
echo "WS=$WS"
echo "DOC=$DOC"
