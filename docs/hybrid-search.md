# 知识库混合检索

检索使用语义向量和 BM25 各召回 64 个候选，Qdrant 通过 RRF 合并为 64 个候选，随后复用现有重排序返回 6 个结果。两路使用相同的知识库和可用文档过滤条件。

BM25 使用 FastEmbed 的 `Qdrant/bm25`，入库和查询均先进行 Jieba 中文分词，禁用英文词干与停用词处理。BM25 无模型权重，此配置无需下载资源文件。BM25 和 RRF 使用默认评分参数，不新增环境配置，不需要 GPU。

## 旧数据迁移与部署

Qdrant 1.15.5 不支持给已有 Collection 增加命名向量，因此新索引使用 `${QDRANT_COLLECTION_NAME}_hybrid`。原 Collection 保留。迁移脚本复制原切片 ID、正文、全部 Payload 和语义向量，再生成 BM25 向量；不会调用语义向量 API。已存在于新 Collection 的切片会跳过，可中断后重跑。

在项目根目录执行：

```sh
docker compose build backend knowledge-worker
docker compose stop backend knowledge-worker
docker compose run --rm --no-deps knowledge-worker python -m scripts.backfill_bm25
docker compose up -d --no-deps backend knowledge-worker
```

迁移期间暂停文档写入，完成后再启动新版服务。迁移失败时先修复并重跑，完成前不要启动新版服务。不要删除旧 Collection。

全新部署无需运行迁移脚本，知识库 Worker 会自动创建混合检索 Collection。
