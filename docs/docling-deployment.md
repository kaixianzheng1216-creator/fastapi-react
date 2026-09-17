# Docling 独立部署

## 全 Docker 运行

默认前端、后端和依赖服务均通过 Docker 运行。首次将 `.env.example` 复制为 `.env` 并填写密钥。浏览器访问 `http://localhost:3001`，服务之间使用容器名通信。

```bash
docker compose up -d
```

## 主服务器

修改 `.env`：

```dotenv
DOCLING_BASE_URL=http://175.178.76.155:5001
```

聊天、调研及独立图片描述直接使用 `.env` 中的 `NEWAPI_BASE_URL` 和 `NEWAPI_API_KEY`。
`DEFAULT_MODEL_NAME` 使用 `deepseek-flash`（默认）或 `deepseek-v4-pro`，不带供应商前缀。
两个模型均支持思考模式，仅 Flash 支持图片。含图片的会话请使用 Flash。

启动（不运行本地 Docling）：

```bash
docker compose -f compose.yml up -d --remove-orphans
```

`--remove-orphans` 会清理当前项目中已移出配置的容器，包括旧 Docling 和 LiteLLM。

从旧版迁移时，先等待队列中的任务结束，再更新环境变量并执行：

```bash
docker compose -f compose.yml up -d --build --remove-orphans
```

删除旧的 `LITELLM_*` 环境变量，并刷新已打开的网页以更新模型选择。
会话表没有模型名称字段；活动任务的请求会保存模型名称，并在任务结束后清空，因此先排空任务，无需迁移历史会话表。
解析服务器也需要更新下文的 NewAPI 地址、密钥并重新创建 Docling 容器。

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
NEWAPI_API_KEY=changethis

DOCLING_PICTURE_DESCRIPTION_URL=https://你的NewAPI地址/v1/chat/completions
```

填写与主服务器相同的 NewAPI 服务地址和可访问 `deepseek-flash` 的密钥。
本地 Docker 部署也需设置 `DOCLING_PICTURE_DESCRIPTION_URL`，地址指向 NewAPI 的 `/v1/chat/completions`。

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

## 图片描述提示词

在对应服务器的 `.env` 中配置：

```dotenv
IMAGE_DESCRIPTION_PROMPT='请用中文简洁、忠实地描述图片，保留理解图片所需的具体细节。若包含图表或数值，请说明对应的标签和数据。'
```

主服务器用于单独上传的图片，Docling 服务器用于文档内的图片；如需一致，请在两台服务器填写相同内容。保持单行，建议使用中文引号；Docling 会将此值插入 JSON 配置，英文双引号和反斜杠需要按 JSON 规则转义。

修改后重建对应容器以加载环境变量：

```bash
# 主服务器（更新代码后）
sudo docker compose -f compose.yml up -d --build knowledge-worker

# Docling 服务器
sudo docker compose -f compose.docling.yml up -d
```

已有文档的图片描述不会自动更新。

## 网络

安全组仅允许主服务器访问解析服务器的 5001。解析服务器直接通过 HTTPS 访问 NewAPI，无需访问主服务器的 4000 端口。
