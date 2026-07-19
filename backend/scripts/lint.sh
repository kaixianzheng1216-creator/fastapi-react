#!/usr/bin/env bash

set -e
set -x

mypy app scripts
ty check app scripts
ruff check app scripts alembic/env.py
ruff format app scripts alembic/env.py --check
