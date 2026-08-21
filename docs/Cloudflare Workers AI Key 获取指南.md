# 获取 Cloudflare Workers AI Key

本文说明如何获取项目调用 Cloudflare Workers AI 所需的 API Token 和 Account ID，并验证 BGE-M3 Embedding 接口。

## 创建 API Token

1. 注册或登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 打开 [Workers AI](https://dash.cloudflare.com/?to=/:account/workers-ai)
3. 选择 **Use REST API**
4. 选择 **Create a Workers AI API Token**
5. 确认模板包含 `Workers AI - Read` 和 `Workers AI - Edit` 权限
6. 选择 **Create API Token**，立即复制并保存 Token

优先使用 Workers AI 提供的 Token 模板。手动创建 Token 时，只授权实际使用的 Cloudflare Account，不要授予其他账户或产品权限。

## 获取 Account ID

Workers AI 的 **Use REST API** 页面会同时显示 Account ID。复制该值，与 API Token 分开保存。

项目需要以下配置：

```dotenv
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id_here
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here
```

将真实值写入本地 `.env` 或部署平台的 Secret，不要提交到 Git。

## 验证 Embedding 接口

在 PowerShell 中临时设置环境变量：

```powershell
$env:CLOUDFLARE_ACCOUNT_ID = "your_cloudflare_account_id_here"
$env:CLOUDFLARE_API_TOKEN = "your_cloudflare_api_token_here"
```

调用 Cloudflare 的 OpenAI 兼容接口：

```powershell
$baseUrl = "https://api.cloudflare.com/client/v4/accounts"
$url = "$baseUrl/$env:CLOUDFLARE_ACCOUNT_ID/ai/v1/embeddings"

curl.exe --request POST `
  --url $url `
  --header "Authorization: Bearer $env:CLOUDFLARE_API_TOKEN" `
  --header "Content-Type: application/json" `
  --data '{"model":"@cf/baai/bge-m3","input":"知识库检索测试"}'
```

成功响应包含 `data[0].embedding`。BGE-M3 返回 1,024 维向量。

## 项目固定配置

首版固定以下参数：

| 配置 | 值 |
| --- | --- |
| 托管服务 | Cloudflare Workers AI |
| 模型 | `@cf/baai/bge-m3` |
| 向量维度 | 1,024 |
| 距离度量 | Cosine |
| 本地 tokenizer | `BAAI/bge-m3` |

模型或 tokenizer 变化后必须重建全部向量，不能复用现有 Qdrant Collection。

## 官方文档

- [获取 API Token 和 Account ID](https://developers.cloudflare.com/workers-ai/get-started/rest-api/)
- [OpenAI 兼容接口](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/)
- [BGE-M3 模型](https://developers.cloudflare.com/ai/models/@cf/baai/bge-m3/)
- [Workers AI 定价](https://developers.cloudflare.com/workers-ai/platform/pricing/)
