#! /usr/bin/env bash

set -e
set -x

# 等待数据库启动
python -m scripts.prestart

# 执行数据库迁移
alembic upgrade head

# 创建数据库初始数据
python -m scripts.initial_data
