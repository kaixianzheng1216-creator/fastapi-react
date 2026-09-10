# Docling 独立部署

## 本地

```bash
docker compose up -d
```

## 主服务器

修改 `.env`：

```dotenv
DOCLING_BASE_URL=http://解析服务器公网IP:5001
LITELLM_BIND_HOST=0.0.0.0
```

启动（不运行本地 Docling）：

```bash
docker compose -f compose.yml up -d --remove-orphans
```

`--remove-orphans` 会清理当前项目中已移出配置的容器，包括旧 Docling。

## 解析服务器

在解析服务器存放这两个文件的独立目录执行：

```bash
cp -i compose.docling.yml compose.yml
cp -i .env.docling.example .env
```

修改 `.env`，其余值保留：

```dotenv
DOCLING_PICTURE_DESCRIPTION_URL=http://主服务器公网IP:4000/v1/chat/completions
LITELLM_MASTER_KEY=与主服务器相同的密钥
```

启动：

```bash
docker compose up -d
```

## 网络

安全组仅允许主服务器访问解析服务器的 5001、解析服务器访问主服务器的 4000。公网 HTTP 为明文传输，会产生流量。
