#! /usr/bin/env bash

set -e
set -x

# 等待数据库启动
python -m scripts.prestart

# 执行数据库迁移
python -m alembic upgrade head
