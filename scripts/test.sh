#! /usr/bin/env sh

# 发生错误时立即退出
set -e
set -x

docker compose build
docker compose down -v --remove-orphans # 清理此前因错误遗留的异常服务栈
docker compose up -d
docker compose exec -T backend bash scripts/tests-start.sh "$@"
docker compose down -v --remove-orphans
