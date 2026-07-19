# AGENTS.md

## 项目概况

这是一个基于 FastAPI 官方全栈模板的前后端分离项目：

- `backend/`：Python 3.14、FastAPI、SQLModel、PostgreSQL、Alembic。
- `compose.yml` 与 `compose.override.yml`：生产及本地开发服务编排。

当前核心领域是用户、认证和 Item CRUD。新增业务应使用真实领域名称，不要继续扩展示例 `Item` 模型来承载无关概念。

## 工作原则

- 修改前先阅读相关入口和调用链；只改任务范围内的代码。
- 优先使用标准库、框架原生能力和现有依赖。引入新的生产依赖前先说明必要性并征得确认。
- 先实现能跑通核心路径的最小方案，不为假设中的未来需求添加接口、工厂或配置层。
- 修复缺陷应处理产生问题的源头；若同一模式在多处存在，应统一修复并补回归检查。
- 保持依赖单向和职责清晰。简单逻辑不做过度拆分，跨模块只通过公开函数或事件协作。
- 不修改生成文件、迁移历史、锁文件或无关格式，除非任务确实要求。
- 不覆盖用户已有的未提交改动，不执行破坏性 Git 命令。

## 后端约定

- API 入口在 `backend/app/main.py`，总路由在 `backend/app/api/router.py`，共享 HTTP 依赖在 `backend/app/api/dependencies.py`。
- 业务代码按领域位于 `backend/app/modules/<domain>/`，每个领域自行管理 router、models、schemas、service、dependencies 和 exceptions。
- 数据库 Engine 与模型注册入口位于 `backend/app/db/`；启动初始化逻辑位于 `backend/app/bootstrap/`。
- 公开函数、路由签名和返回值必须标注类型；命名使用完整、描述性的英文单词。
- 在 API 等信任边界校验输入。领域错误与 HTTP 响应解耦，由边界层完成状态码映射。
- 异常默认向上冒泡，只在外部入口、持久化或第三方服务等边界捕获；不得吞异常或使用空 `except`。
- 鉴权、授权、密码和令牌属于安全路径，修改时必须覆盖失败分支且不得泄露内部信息。
- 修改持久化模型时必须新增 Alembic revision；不要通过 `SQLModel.metadata.create_all()` 代替迁移。

## 常用命令

在仓库根目录执行：

```bash
docker compose watch
```

后端命令在 `backend/` 目录执行：

```bash
uv sync
fastapi dev app/main.py
uv run ruff check .
uv run mypy app
```

## 验证与交付

- 验证强度与改动风险匹配，至少运行覆盖所改路径的最小检查。
- 数据库、权限、认证和数据删除改动必须验证成功与失败路径。
- 交付时说明改了什么、运行了哪些检查，以及因环境限制未运行的检查。
- 不声称未执行的测试已经通过。

## 代码审查重点

- 优先发现行为回归、越权访问、数据丢失、迁移遗漏、OpenAPI 客户端不同步和缺失测试。
- 评论应指出具体影响和复现条件；纯风格偏好不应阻塞交付。
- 文档与注释使用 UTF-8。注释解释原因或约束，不复述代码表面行为。
