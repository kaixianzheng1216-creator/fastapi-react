#!/bin/sh -e
set -x

ruff check app tests scripts alembic/env.py --fix
ruff format app tests scripts alembic/env.py
