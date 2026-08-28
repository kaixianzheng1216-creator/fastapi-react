# 内容平台排行榜 API 调研报告

调研日期：2026-08-28  
目标平台：抖音、快手、小红书、B 站  
业务目标：为内容运营后台提供真实、可分类、可保存历史快照的内容排行榜。

## 1. 结论摘要

不建议为了“统一供应商”强行选择一家覆盖四个平台。当前更合理的第一版组合是：

| 平台 | 建议来源 | 展示语义 |
| --- | --- | --- |
| 抖音 | Just One API 主选；TikHub 备选 | 热门视频 |
| 快手 | TikHub 快手热榜 V2 | 热门话题/频道榜 |
| 小红书 | RedNote API 主选；Just One API 备选 | 蒲公英热门笔记 |
| B 站 | 保留现有直连排行榜 | 热门视频 |

最重要的限制是：四个平台并不存在完全同口径的排行榜。抖音和 B 站更接近视频榜，小红书是笔记榜，现有快手接口更接近热搜/频道榜。前端可以保持统一布局，但必须准确标注榜单语义，不能把它们描述成同一种算法产生的榜单。

## 2. 评价方法

本报告按以下维度评价。评分仅基于公开文档，不代表实测 SLA：

| 维度 | 权重 | 说明 |
| --- | ---: | --- |
| 榜单业务匹配度 | 30% | 是否是真正面向内容运营的排行榜，而不只是关键词搜索 |
| 分类和排序能力 | 25% | 是否支持垂类、时间窗口、排序指标和内容类型 |
| 出参契约完整度 | 20% | 文档是否明确到单条内容字段，而不只是 `data: {}` |
| 四平台覆盖能力 | 10% | 是否能减少供应商数量 |
| 接入与运行风险 | 10% | 鉴权、分页、错误码、版本变化和重试要求 |
| 成本透明度 | 5% | 是否公开价格并允许低成本试用 |

## 3. 供应商总览

| 供应商 | 抖音 | 快手 | 小红书 | B 站 | 主要优势 | 主要问题 |
| --- | --- | --- | --- | --- | --- | --- |
| TikHub | 强 | 中 | 中 | 有 | 覆盖广；抖音榜型丰富；按量计费透明 | 多数榜单的真实 `data` 结构未在文档定义 |
| Just One API | 很强 | 当前无合适垂类榜 | 中 | 主要是搜索/详情 | 抖音筛选能力最完整；国内支持渠道更方便 | Token 放 URL；核心 `data` 未定义；价格登录后可见 |
| RedNote API | 无 | 无 | 很强 | 无 | 小红书参数和返回字段最清楚 | 单平台；依赖蒲公英数据路径 |
| OneAPI | 弱 | 弱到中 | 弱 | 有 | 平台覆盖广；可免费试用 | 参数少；出参弱；不同版本结构可能不同 |
| 国内数据 SaaS | 可能很强 | 可能很强 | 可能很强 | 视产品而定 | 成熟分析、行业榜和商业数据 | 通常没有公开标准 OpenAPI，采购和二次集成成本不透明 |

## 4. 抖音详细比较

### 4.1 TikHub 视频热榜

接口：`POST /api/v1/douyin/billboard/fetch_hot_total_video_list`

主要入参：

- `page`、`page_size`
- `date_window`：1、24、72、168 小时
- `sub_type`：总榜、低粉爆款、高完播率、高涨粉率、高点赞率
- `keyword`
- `tags`：垂类标签树，标签 ID 由另一个接口获取

优点：

- 是视频榜，不是普通搜索结果。
- “低粉爆款、高完播率、高涨粉率”非常符合内容运营场景。
- 时间窗口明确，适合每天脚本采集快照。

不足：

- 分类依赖供应商标签 ID，需要额外同步分类常量。
- 公开示例只定义外层 `code/request_id/params/data`，`data` 为 `null`，没有稳定的 item schema。
- 在试调用前，不能确认标题、封面、作者、互动指标的准确字段路径。

来源：[TikHub 抖音视频热榜](https://docs.tikhub.io/252393853e0)

### 4.2 Just One API 抖音热门内容

接口：`GET /api/douyin/hot-search/v1`

主要入参：

- `keyword`
- `contentType`：34 类以上，覆盖时尚、科技、摄影、美食、母婴、游戏、汽车、旅行、音乐、教育、财经等
- `videoType`：全部、星图商业视频、自然视频
- `sortType`：综合、互动、点赞、评论、分享
- `page`：每页固定 10 条
- 点赞、评论、分享、互动量上下限
- 创作者粉丝数上下限

优点：

- 垂类、排序和创作者规模筛选最完整。
- 可以区分商业内容和自然内容。
- 非常适合作为内容发现和竞品研究入口。

不足：

- 名称叫“热搜”，业务说明实际更接近可筛选的热门内容搜索，需要用真实样本确认其排名是否具有稳定榜单语义。
- OpenAPI 只定义 `code/message/data/recordTime/requestId`，其中 `data` 没有 schema。
- Token 放在查询参数中，容易进入网关访问日志，安全性不如 Authorization Header。

来源：[Just One API 抖音接口](https://docs.justoneapi.com/zh/api/douyin-tiktok-china/hot-search-v1)、[OpenAPI 定义](https://docs.justoneapi.com/openapi/douyin-tiktok-china/hot-search-v1-zh.json)

### 4.3 抖音建议

第一版优先测试 Just One API，因为它最符合“按不同内容分区切换排行榜”的 UI。若低粉爆款、高完播率等榜型更重要，则改用 TikHub 或同时保留 TikHub 作为第二来源。

## 5. 小红书详细比较

### 5.1 Just One API 蒲公英内容广场

接口：`GET /api/xiaohongshu-pgy/api/pgy/content_square/search_note_v2/v1`

支持：

- 关键词、页码
- 小红书热门、产品种草、电商推广、蒲公英合作、线索收集、电商热门、直接种草、App 推广
- 曝光、阅读率、阅读量、互动量、互动率、点赞、收藏、评论排序
- 3、7、14、30 日时间窗口

优点是第一版参数少、容易接入；不足是没有在公开接口中暴露内容类目、所属行业、图文/视频、题材等细分筛选，且 `data` 仍未定义。

来源：[Just One API 蒲公英内容广场](https://docs.justoneapi.com/zh/api/xiaohongshu-creator-marketplace-pugongying/content-square-notes-v1)

### 5.2 RedNote API 蒲公英内容广场

接口：`POST /api/v2/pgy/content/square`

主要入参：

- `biz_type`、`page_num`、`page_size`
- `search_word`、`order_by`、`date_range`
- `category`、`industry`
- `note_type`、`content_type`
- `theme`、`author_type`、`placement`
- `marketing_target`、`price`、`fans`

分类包括美妆、护肤、母婴、时尚、美食、家居、影视综、运动、宠物、教育、职场、摄影、游戏、科技数码、旅游、汽车、商业财经等。

公开出参明确到：

- `noteList[].noteInfo.title`
- `noteType`、`noteLink`、`noteImages`
- `readNum`、`likeNum`、`favNum`、`cmtNum`
- `videoDuration`、`notePublishTime`
- 博主信息
- `total`、`pageInfoDto`

优点：

- 是本次调研中唯一把小红书榜单入参和内容 item 出参都写清楚的服务。
- 不支持的榜单与筛选组合会返回 422，不会静默忽略。
- 很适合后台做严格 Pydantic 校验。

不足：

- 每页最多 34 条，榜单总量固定 Top 100。
- 文档明确 `totalPage` 不可靠，需要用 `total` 自行计算。
- 单平台供应商，无法降低四平台接入数量。

来源：[RedNote 内容广场](https://docs.rnote.dev/505264894e0)

### 5.3 小红书建议

优先 RedNote API。Just One API 只适合希望减少供应商或先做非常小的验证版本时使用。

## 6. 快手详细比较

TikHub 快手热榜 V2 支持 `board_type`：热榜、文娱、社会、有用、挑战、搜索。

它的主要问题不是接口少，而是榜单语义与其他平台不一致：返回更接近热搜词、热点或频道榜，不一定是具体视频内容榜；同时没有美食、汽车、数码等垂类，也没有排序指标和时间窗口。

来源：[TikHub 快手热榜 V2](https://docs.tikhub.io/343542242e0)

当前建议：

- 第一版可以接入，但前端标题必须是“快手热门话题”，不能叫“热门视频”。
- 如果产品要求快手垂类视频榜，需要向 TikHub、Just One API 或国内数据 SaaS 询价定制；当前公开标准接口不足以满足。

## 7. B 站详细判断

当前项目已经通过 B 站直接排行榜获得视频榜和分区数据，并已建立历史快照。聚合供应商虽提供 B 站搜索、综合热门或排行榜，但不会明显改善当前能力，反而增加成本和第三方依赖。

因此 B 站继续直连，仅在接口明显失效时再评估供应商备用源。

## 8. 协议与运行风险

### 8.1 鉴权

- TikHub：Bearer Header，较规范。
- RedNote：`X-API-Key` Header，较规范。
- Just One API：Token 查询参数，必须避免在应用日志、反向代理日志中记录完整 URL。
- OneAPI：Header API Key，但具体接口契约较弱。

### 8.2 错误与重试

- Just One API 以 `code=0` 表示成功，建议 60–120 秒超时；成功请求计费。
- TikHub 以 `code=200` 表示成功，公开价格说明通常只对成功请求计费。
- OneAPI 无论业务成功失败都可能返回 HTTP 200，必须读取 body `code`；文档还说明不同版本响应结构可能不同。

重试只应用于网络错误、超时和供应商明确的采集失败业务码；参数错误、余额不足、权限不足不能重试。

来源：[Just One API 使用指南](https://docs.justoneapi.com/zh/usage)、[OneAPI 使用指南](https://doc.getoneapi.com/)

### 8.3 供应商与上游变化

这些服务都依赖第三方平台和实时采集链路。Just One API 的服务条款明确表示字段、格式和可用性可能随上游变化，且不保证持续无错误。第一版必须由我们自己的清洗模型隔离供应商原始结构。

来源：[Just One API 服务条款](https://justoneapi.com/zh/terms)

## 9. 成本比较

TikHub 的公开价格最透明：通常为每次 0.001–0.01 美元，按日请求量提供折扣，新账号约有 50 次免费测试。具体榜单端点仍应在控制台确认价格。

Just One API 和 RedNote API 的公开页面没有给出本次目标端点的固定单价，需要登录后台或联系供应商；二者都提供试用或按成功请求计费的说明。

来源：[TikHub Pricing](https://tikhub.io/pricing)、[Just One API 使用指南](https://docs.justoneapi.com/zh/usage)

成本不能只按调用单价比较。榜单每日只需按“平台 × 分类”采集一次，实际更大的成本来自字段变化、失败排查和供应商切换。因此出参契约质量比每次调用相差几厘钱更重要。

## 10. 第一版数据模型建议

保留历史快照，但不保存无用的完整第三方响应。

快照字段：

- `platform`
- `category_code`
- `captured_at`
- `source`

内容字段：

- `rank`
- `content_id`
- `title`
- `cover_url`
- `content_url`
- `author_name`
- `content_category_name`
- `published_at`
- `duration_seconds`（可空）
- `view_count` / `read_count`（可空且不能混为同一含义）
- `like_count`、`favorite_count`、`comment_count`、`share_count`、`danmaku_count`（均可空）

不存在的指标必须保存为 `NULL`，不能用 0 代表没有数据。

## 11. 采购前 POC 验收清单

不能只看文档。每个候选接口至少连续测试 7 天，每天固定三个时点采样，并验收：

1. 同一参数是否稳定返回相同字段结构。
2. 第一页与第二页是否重复或漏项。
3. 分类筛选是否真实生效，而非返回总榜。
4. 排序指标是否单调或基本符合排序含义。
5. 内容 ID、链接、封面是否可长期使用。
6. 删除或下架内容如何表现。
7. 失败是否计费，业务错误码是否稳定。
8. P50、P95 响应时间和成功率。
9. 同一内容的指标能否与平台页面抽样对上。
10. 供应商是否允许保存历史快照和内部商业分析。

最低验收线建议：成功率不低于 98%，分类命中准确率不低于 95%，核心字段缺失率低于 1%，连续 7 天不发生未通知的字段结构变化。

## 12. 最终建议

第一阶段不要建设复杂的供应商抽象层，只为四个平台分别实现一个清洗函数，并输出相同的内部模型：

1. 抖音同时试用 Just One API 与 TikHub，依据 7 天 POC 决定主源。
2. 小红书直接试用 RedNote API，同时拿 Just One API 做一次出参对照。
3. 快手先接 TikHub，但将产品语义限定为热门话题；不要伪装成垂类视频榜。
4. B 站保持现有直连实现。
5. 后端脚本负责采集和生成历史快照，前端只读取数据库，不提供刷新按钮。

这套方案没有追求表面上的统一供应商，而是优先保证榜单真实、分类有效、字段可以被代码稳定消费。
