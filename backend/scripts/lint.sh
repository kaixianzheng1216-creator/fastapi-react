#!/usr/bin/env bash

set -e
set -x

mypy app scripts
ty check app scripts
ruff check app tests scripts alembic/env.py
ruff format app tests scripts alembic/env.py --check
