# FastAPI 项目 - 前端

前端使用 [Vite](https://vitejs.dev/)、[React](https://reactjs.org/)、[TypeScript](https://www.typescriptlang.org/)、[TanStack Query](https://tanstack.com/query)、[TanStack Router](https://tanstack.com/router) 和 [Tailwind CSS](https://tailwindcss.com/) 构建。

## 环境要求

- [Bun](https://bun.sh/)（推荐）或 [Node.js](https://nodejs.org/)

## 快速开始

```bash
bun install
bun run dev
```

* 然后在浏览器中打开 http://localhost:5173/。

需要注意的是，这个实时服务器并没有运行在 Docker 内部，它是用于本地开发的，这也是推荐的工作流程。当你对前端满意之后，可以构建前端 Docker 镜像并启动它，在类似生产的环境中测试。但每次改动都重新构建镜像，效率远不如运行带热重载的本地开发服务器。

查看 `package.json` 文件以了解其他可用选项。

### 移除前端

如果你正在开发纯 API 应用并希望移除前端，可以轻松完成：

* 删除 `./frontend` 目录。

* 在 `compose.yml` 文件中，删除整个 `frontend` 服务/段。

* 在 `compose.override.yml` 文件中，删除整个 `frontend` 和 `playwright` 服务/段。

完成，你就有了一个无前端（纯 API）的应用。🤓

---

如果你愿意，也可以从以下位置移除 `FRONTEND` 环境变量：

* `.env`
* `./scripts/*.sh`

不过这只起到清理作用，保留它们也不会带来任何影响。

## 生成客户端

### 自动生成

* 激活后端虚拟环境。
* 在项目根目录运行脚本：

```bash
bash ./scripts/generate-client.sh
```

* 提交更改。

### 手动生成

* 启动 Docker Compose 栈。

* 从 `http://localhost/api/v1/openapi.json` 下载 OpenAPI JSON 文件，并将其复制到 `frontend` 目录下命名为 `openapi.json` 的新文件中。

* 生成前端客户端，运行：

```bash
bun run generate-client
```

* 提交更改。

注意，每当后端发生变化（修改了 OpenAPI schema）时，都应该再次执行以上步骤来更新前端客户端。

## 使用远程 API

如果你希望使用远程 API，可以将环境变量 `VITE_API_URL` 设置为远程 API 的 URL。例如，你可以在 `frontend/.env` 文件中设置：

```env
VITE_API_URL=https://api.my-domain.example.com
```

然后，当你运行前端时，它会使用该 URL 作为 API 的基础地址。

## 代码结构

前端代码结构如下：

* `frontend/src` - 前端主要代码。
* `frontend/src/assets` - 静态资源。
* `frontend/src/client` - 生成的 OpenAPI 客户端。
* `frontend/src/components` - 前端的各个组件。
* `frontend/src/hooks` - 自定义 hooks。
* `frontend/src/routes` - 前端的各个路由（包含页面）。

## 使用 Playwright 进行端到端测试

前端包含使用 Playwright 编写的初始端到端测试。要运行测试，你需要先启动 Docker Compose 栈。使用以下命令启动：

```bash
docker compose up -d --wait backend
```

然后，使用以下命令运行测试：

```bash
bunx playwright test
```

你也可以在 UI 模式下运行测试，这样可以查看浏览器并与之交互：

```bash
bunx playwright test --ui
```

要停止并移除 Docker Compose 栈，同时清理测试中创建的数据，使用以下命令：

```bash
docker compose down -v
```

要更新测试，请进入测试目录，按需修改现有测试文件或添加新文件。

有关编写和运行 Playwright 测试的更多信息，请参阅官方 [Playwright 文档](https://playwright.dev/docs/intro)。
