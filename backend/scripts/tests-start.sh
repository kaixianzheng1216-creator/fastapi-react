#! /usr/bin/env bash
set -e
set -x

python -m scripts.prestart

bash scripts/test.sh "$@"
