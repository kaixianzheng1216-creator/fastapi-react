#! /usr/bin/env bash

set -e
set -x

if command -v uv >/dev/null 2>&1; then
  uv run --directory backend python -c "import app.main; import json; print(json.dumps(app.main.app.openapi()))" > frontend/openapi.json
elif command -v powershell.exe >/dev/null 2>&1; then
  workspace_path=$(wslpath -w "$PWD")
  powershell.exe -NoProfile -Command "Set-Location '$workspace_path'; uv run --directory backend python -c \"import app.main; import json; print(json.dumps(app.main.app.openapi()))\"" > frontend/openapi.json
else
  echo "uv is required to generate the OpenAPI document" >&2
  exit 1
fi

npm --prefix frontend run generate-client
npm --prefix frontend run lint
