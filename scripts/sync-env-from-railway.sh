#!/usr/bin/env bash
# Pull production variables from linked Railway service into .env (for local dev against Railway).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SERVICE="${1:-qms-api}"
railway variables --json > /tmp/railway-vars.json
python3 <<'PY'
import json, pathlib, re
data = json.load(open("/tmp/railway-vars.json"))
lines = []
for k, v in sorted(data.items()):
    if not isinstance(v, str):
        continue
    val = v.replace("\n", " ")
    if re.search(r'[\s#"$`\\]', val):
        esc = val.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'{k}="{esc}"')
    else:
        lines.append(f"{k}={val}")
pathlib.Path(".env").write_text("\n".join(lines) + "\n")
print(f"Wrote {len(lines)} variables to .env")
PY

DB_PUBLIC="$(railway variables --service Postgres --json | python3 -c "import json,sys; print(json.load(sys.stdin)['DATABASE_PUBLIC_URL'])")"
REDIS_PUBLIC="$(railway variables --service Redis --json | python3 -c "import json,sys; print(json.load(sys.stdin).get('REDIS_PUBLIC_URL',''))" 2>/dev/null || true)"
export DB_PUBLIC REDIS_PUBLIC
python3 <<'PY'
import pathlib, re, os
p = pathlib.Path(".env")
text = p.read_text()
db = os.environ.get("DB_PUBLIC", "")
if db:
    if re.search(r"^DATABASE_URL=", text, re.M):
        text = re.sub(r"^DATABASE_URL=.*$", "DATABASE_URL=" + db, text, flags=re.M)
    else:
        text += "DATABASE_URL=" + db + "\n"
redis = os.environ.get("REDIS_PUBLIC", "")
if redis:
    for key in ("REDIS_URL", "REDIS_PRIVATE_URL"):
        if re.search(rf"^{key}=", text, re.M):
            text = re.sub(rf"^{key}=.*$", f"{key}=" + redis, text, flags=re.M)
    if not re.search(r"^REDIS_URL=", text, re.M):
        text += "REDIS_URL=" + redis + "\n"
p.write_text(text)
print("Patched .env with Railway public DATABASE_URL" + (" and REDIS_URL" if redis else ""))
PY
