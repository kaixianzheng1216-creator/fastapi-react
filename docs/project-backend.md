# 项目后端接入

前后端已接入项目、成员、知识库隔离与项目 MCP。前端复用原有 shadcn/ui 组件，API 客户端随接口重新生成。

## 接口

以下 REST 路径统一加 `/api/v1`，使用现有用户登录认证。

| 路径 | 用途 |
| --- | --- |
| `/admin/projects` | GET 可访问项目及角色、成员数、知识库数；POST 创建项目，可传 `admin_ids` |
| `/admin/projects/{id}` | GET 详情、PATCH 名称/描述、DELETE 空项目 |
| `/admin/projects/{id}/members` | GET 成员；POST `user_ids` 批量添加普通成员 |
| `/admin/projects/{id}/member-candidates` | GET 可选择的账号及 `is_member`，支持服务端搜索、分页 |
| `/admin/projects/{id}/members/{user_id}` | PATCH `role`；DELETE 移出 |
| `/admin/knowledge-bases` | GET 查询参数、POST 请求体必须携带 `project_id`；其余原知识库/文档路径保持不变 |
| `/mcp/keys` | 创建传 `project_id`、`permission`；列表传 `project_id` |
| `/mcp/keys/{id}` | 沿用 PUT 名称、启停，项目密钥可修改 `permission`；DELETE 撤销 |
| `/users/` | 管理员创建用户可传 `projects: [{project_id, role}]`，与用户创建同事务提交 |

项目、成员、候选账号、项目密钥列表支持 `search`、`skip`、`limit`，返回 `data` 和 `count`。成员支持 `role`，密钥支持 `permission`、`is_active` 筛选。

超级管理员管理项目及角色。项目管理员仅额外拥有查看、添加、移出普通成员的权限。全部项目成员可以维护本项目知识库、文档和密钥。无项目权限返回 404；有项目权限但无操作权限返回 403。

## MCP

连接 `/mcp/project/`，通过 `Authorization: Bearer <项目密钥>` 认证，同时提供知识库工具和区域数据、B 站榜单、达人数据查询工具。知识库项目从密钥确定，不能指定其他项目；业务查询使用平台共用数据。

- `read_only`：仅开放已启用知识库列表与检索。
- `read_write`：允许维护该项目全部知识库及文档，并使用三个平台业务数据查询工具。
- 每次调用重新验证密钥状态和权限；创建人移出、停用或软删除不影响项目密钥。
- 只提供 `/mcp/project/`，旧 `/mcp/internal/`、`/mcp/external/` 入口已移除。

项目 MCP 业务工具复用项目密钥校验，不依赖超级管理员账号；普通后台业务 REST 接口仍要求管理员身份。工具以 `PROJECT_OPERATIONS` 显式清单注册，未开放平台用户、项目或成员管理能力。

## 发布与迁移

本次发布包含数据库迁移 `000000000009`，新增项目、成员表，并修改知识库和密钥表。现有知识库归入“默认项目”，原 ID、文档和向量数据保留；现有用户不自动加入项目，由超级管理员分配。

1. 发布前备份数据库，通知旧 MCP 客户端更换地址和密钥；本次迁移会删除所有旧 MCP 密钥。
2. 暂停应用访问及后台写入，执行 `uv run --directory backend alembic upgrade head`，统一更新后端、后台任务服务和前端，再恢复访问。旧后端不能继续写入迁移后的知识库表。
3. 超级管理员在“平台管理”分配项目成员；在目标项目的“MCP 接入”创建项目密钥。原只读接入选择“只读”，需要维护知识库的接入选择“读写”。
4. 将客户端地址改为 `/mcp/project/`，替换为新项目密钥，并重新获取工具列表。验证查询、所需写入权限以及跨项目访问被拒绝。

这是破坏性升级：旧 MCP 地址和密钥均不再可用。

回退 `000000000009` 时会删除项目密钥；如果已存在跨项目同名知识库，旧的全局唯一约束会阻止回退。需要保留密钥时应从备份恢复，并同步回退前后端及后台任务服务。

## 验证

已通过后端 Ruff/Mypy、前端类型检查与生产构建。迁移在独立临时 PostgreSQL 数据库中完成 `0008 → 0009 → 0008` 验证：旧知识库归入默认项目，旧 MCP 密钥被删除，回滚后旧知识库仍在。临时数据库已删除。对象存储、文件解析和向量服务未做端到端验证。

常规检查命令：

```text
uv run --directory backend ruff check app
uv run --directory backend mypy app
npm --prefix frontend run lint
npm --prefix frontend run build
```
