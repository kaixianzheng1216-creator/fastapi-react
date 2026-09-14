# Docling 独立部署

## 全 Docker 运行

默认前端、后端和依赖服务均通过 Docker 运行。首次将 `.env.example` 复制为 `.env` 并填写密钥。浏览器访问 `http://localhost:3001`，服务之间使用容器名通信。

```bash
docker compose up -d
```

## 主服务器

修改 `.env`：

```dotenv
LITELLM_BIND_HOST=0.0.0.0

DOCLING_BASE_URL=http://175.178.76.155:5001
```

启动（不运行本地 Docling）：

```bash
docker compose -f compose.yml up -d --remove-orphans
```

`--remove-orphans` 会清理当前项目中已移出配置的容器，包括旧 Docling。

## 解析服务器

服务器需已安装 Git、Docker 和 Docker Compose。首次获取代码：

```bash
git clone https://github.com/kaixianzheng1216-creator/fastapi-react.git

cd fastapi-react
```

已有仓库则进入项目目录更新：

```bash
git pull --ff-only
```

首次配置：

```bash
cp -i .env.docling.example .env
```

修改 `.env`，其余值保留：

```dotenv
LITELLM_MASTER_KEY=changethis

DOCLING_PICTURE_DESCRIPTION_URL=http://43.139.210.125:4000/v1/chat/completions
```

只启动 Docling：

```bash
docker compose -f compose.docling.yml up -d
```

后续更新无需重新复制 `.env`：

```bash
git pull --ff-only

docker compose -f compose.docling.yml up -d
```

## 两份文档并行处理

主服务器 `.env`：

```dotenv
KNOWLEDGE_MAX_CONCURRENT_DOCUMENTS=2
```

解析服务器 `.env`：

```dotenv
DOCLING_SERVE_ENG_LOC_NUM_WORKERS=2
```

更新代码和配置后，主服务器执行：

```bash
sudo docker compose -f compose.yml up -d --build backend agent-worker knowledge-worker
```

解析服务器执行：

```bash
sudo docker compose -f compose.docling.yml up -d
```

只运行一个 knowledge-worker 容器，内部同时处理两份文档，其余排队；每份独立超时。先用两份较大 PDF 验证解析服务器内存和耗时，再扩大使用。

## 网络

安全组仅允许主服务器访问解析服务器的 5001、解析服务器访问主服务器的 4000。公网 HTTP 为明文传输，会产生流量。
