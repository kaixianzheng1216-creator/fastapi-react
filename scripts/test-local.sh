#! /usr/bin/env bash

# 发生错误时立即退出
set -e

docker-compose down -v --remove-orphans # 清理此前因错误遗留的异常服务栈

if [ $(uname -s) = "Linux" ]; then
    echo "删除 __pycache__ 文件"
    sudo find . -type d -name __pycache__ -exec rm -r {} \+
fi

docker-compose build
docker-compose up -d
docker-compose exec -T backend bash scripts/tests-start.sh "$@"
