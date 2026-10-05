#!/usr/bin/env bash
API=${API:-localhost:8000}
RUN=$RANDOM
PASS=0; FAIL=0

req() {
  local m=$1 p=$2 t=$3 d=$4
  if [ -n "$d" ]; then
    BODY=$(curl -s -w $'\n%{http_code}' -X "$m" "$API$p" -H "Authorization: Bearer $t" -H "Content-Type: application/json" -d "$d")
  else
    BODY=$(curl -s -w $'\n%{http_code}' -X "$m" "$API$p" -H "Authorization: Bearer $t" -H "Content-Type: application/json")
  fi
  CODE=${BODY##*$'\n'}
  BODY=${BODY%$'\n'*}
}

signup() {
  curl -s -X POST "$API/auth/signup" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"password123\",\"name\":\"$2\"}"
}

jget() { python3 -c "import sys,json; print(json.loads(sys.stdin.read()).get('$1',''))"; }

check() {
  local name=$1 want=$2 contains=$3
  if [ "$CODE" = "$want" ] && { [ -z "$contains" ] || [[ "$BODY" == *"$contains"* ]]; }; then
    echo "PASS  $name"; PASS=$((PASS+1))
  else
    echo "FAIL  $name (got $CODE: $BODY)"; FAIL=$((FAIL+1))
  fi
}

ADMIN_EMAIL="admin$RUN@test.com"; BOB_EMAIL="bob$RUN@test.com"; CAROL_EMAIL="carol$RUN@test.com"
A=$(signup "$ADMIN_EMAIL" Admin | jget access_token)
B=$(signup "$BOB_EMAIL" Bob | jget access_token)
C=$(signup "$CAROL_EMAIL" Carol | jget access_token)

req GET /auth/me "$A"
WS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['workspaces'][0]['id'])")
AID=$(echo "$BODY" | jget id)
req GET /auth/me "$B"; BID=$(echo "$BODY" | jget id)
echo "Workspace: $WS"; echo

req POST /workspaces/$WS/invites "$A" "{\"email\":\"$BOB_EMAIL\",\"role\":\"member\"}"
check "admin can invite" 201 invite_token
INV=$(echo "$BODY" | jget invite_token)

req GET /workspaces/$WS/members "$B"
check "outsider gets 404 (not 403)" 404

req POST /invites/accept "$C" "{\"token\":\"$INV\"}"
check "invite is bound to its email" 403

req POST /invites/accept "$B" "{\"token\":\"$INV\"}"
check "invitee can accept" 200 member

req POST /invites/accept "$B" "{\"token\":\"$INV\"}"
check "invite works only once" 404

req GET /workspaces/$WS/members "$B"
check "member can list members" 200

req POST /workspaces/$WS/invites "$B" "{\"email\":\"x$RUN@test.com\",\"role\":\"admin\"}"
check "member cannot invite" 403 "Admin access required"

req PATCH /workspaces/$WS/members/$AID "$B" '{"role":"member"}'
check "member cannot change roles" 403

req POST /workspaces/$WS/invites "$A" "{\"email\":\"$BOB_EMAIL\",\"role\":\"member\"}"
check "cannot invite an existing member" 409

req PATCH /workspaces/$WS/members/$AID "$A" '{"role":"member"}'
check "last admin cannot be demoted" 400

req DELETE /workspaces/$WS/members/$AID "$A"
check "last admin cannot be removed" 400

req DELETE /workspaces/$WS/members/$BID "$B"
check "member can leave" 204

req GET /workspaces/$WS/members "$B"
check "after leaving, access is gone" 404

req POST /workspaces "$A" '{"name":"Side project"}'
check "can create another workspace" 201 admin

echo; echo "Passed: $PASS   Failed: $FAIL"
[ "$FAIL" -eq 0 ]
