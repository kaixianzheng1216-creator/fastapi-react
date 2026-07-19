#!/bin/sh -e
set -x

ruff check app scripts alembic/env.py --fix
ruff format app scripts alembic/env.py
