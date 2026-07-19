# FastAPI 项目 - 开发指南

## Docker Compose

* 使用 Docker Compose 启动本地开发环境：

```bash
docker compose watch
```

* 现在你可以在浏览器中访问以下 URL：

前端，基于 Docker 构建，根据路径处理路由：<http://localhost:5173>

后端，基于 OpenAPI 的 JSON Web API：<http://localhost:8000>

基于 Scalar 的自动交互式文档（来自 OpenAPI 后端）：<http://localhost:8000/scalar>

Traefik UI，可以查看代理是如何处理路由的：<http://localhost:8090>

**注意**：第一次启动开发环境时，可能需要等待一分钟左右才能就绪。这是因为后端需要等待数据库就绪并进行一些初始化配置。你可以通过查看日志来监控这个过程。

要查看日志，可以运行（在另一个终端中）：

```bash
docker compose logs
```

要查看特定服务的日志，可以加上服务名称，例如：

```bash
docker compose logs backend
```

## 本地开发

Docker Compose 文件的配置方式使得每个服务都通过 `localhost` 上的不同端口提供访问。

对于后端和前端，它们使用的端口与本地开发服务器使用的端口相同，因此后端位于 `http://localhost:8000`，前端位于 `http://localhost:5173`。

这样一来，你可以停掉某个 Docker Compose 服务，然后启动它的本地开发服务，所有功能依然可以正常工作，因为它们使用的都是相同的端口。

例如，你可以先停止 Docker Compose 中的 `frontend` 服务，在另一个终端运行：

```bash
docker compose stop frontend
```

然后启动本地的 frontend 开发服务器：

```bash
bun run dev
```

或者你可以停止 `backend` 这个 Docker Compose 服务：

```bash
docker compose stop backend
```

然后可以运行后端的本地开发服务器：

```bash
cd backend
fastapi dev app/main.py
```

## `localhost.tiangolo.com` 下的 Docker Compose

当你启动 Docker Compose 栈时，默认使用 `localhost`，并为每个服务（backend、frontend 等）使用不同的端口。

当你将其部署到生产环境（或预发布环境）时，每个服务会部署在不同的子域名下，例如后端使用 `api.example.com`，前端使用 `dashboard.example.com`。

在关于[部署](deployment.md)的指南中，你可以了解到 Traefik 这个配置好的反向代理。它负责根据子域名将流量转发到对应的服务。

如果你想在本地测试这一切是否正常工作，可以编辑本地的 `.env` 文件，修改：

```dotenv
DOMAIN=localhost.tiangolo.com
```

Docker Compose 文件会使用这个值来配置服务的基础域名。

Traefik 会据此将 `api.localhost.tiangolo.com` 的流量转发到后端，将 `dashboard.localhost.tiangolo.com` 的流量转发到前端。

`localhost.tiangolo.com` 是一个特殊域名，它（包括其所有子域名）被配置为指向 `127.0.0.1`。这样你就可以在本地开发中使用它。

修改完成后，重新运行：

```bash
docker compose watch
```

在生产部署时，主 Traefik 配置在 Docker Compose 文件之外。本地开发时，`compose.override.yml` 中包含了一个内置的 Traefik，方便你测试域名是否能按预期工作，例如 `api.localhost.tiangolo.com` 和 `dashboard.localhost.tiangolo.com`。

## Docker Compose 文件与环境变量

存在一个主 `compose.yml` 文件，包含应用于整个栈的所有配置，它会被 `docker compose` 自动使用。

还有一个 `compose.override.yml` 文件，包含针对开发环境的覆盖配置，例如将源码挂载为卷。它会被 `docker compose` 自动使用，以便在 `compose.yml` 之上应用覆盖。

这些 Docker Compose 文件使用包含配置的 `.env` 文件，这些配置会作为环境变量注入到容器中。

它们还会使用在调用 `docker compose` 命令之前由脚本设置的一些额外环境变量配置。

修改环境变量后，请确保重启整个栈：

```bash
docker compose watch
```

## .env 文件

`.env` 文件包含所有的配置、生成的密钥和密码等。

根据你的工作流程，你可能希望将它排除在 Git 之外，例如当你的项目是公开的情况下。在这种情况下，你需要确保设置一种方式，让你的 CI 工具在构建或部署项目时能够获取到它。

一种可行的方法是将每个环境变量添加到你的 CI/CD 系统中，然后更新 `compose.yml` 文件，使其从该特定环境变量读取，而不是从 `.env` 文件读取。

## Pre-commit 与代码检查

我们使用一个叫做 [prek](https://prek.j178.dev/) 的工具（[Pre-commit](https://pre-commit.com/) 的现代替代品）来进行代码检查和格式化。

当你安装它之后，它会在你进行 git 提交之前自动运行。这样可以确保代码在提交之前就是一致且经过格式化的。

你可以在项目根目录找到一个配置文件 `.pre-commit-config.yaml`。

#### 安装 prek 以自动运行

`prek` 已经是项目依赖的一部分。

在安装好 `prek` 工具并确保它可用之后，你需要在本地仓库中"安装"它，这样它才会在每次提交前自动运行。

使用 `uv`，可以这样做（确保你在 `backend` 目录下）：

```bash
❯ uv run prek install -f
prek installed at `../.git/hooks/pre-commit`
```

`-f` 参数会强制安装，覆盖之前可能已经安装的 `pre-commit` 钩子。

现在，每当你尝试提交时，例如：

```bash
git commit
```

...prek 会运行，检查并格式化你即将提交的代码，并要求你用 git 重新添加（暂存）这些代码，然后再提交。

然后你可以再次 `git add` 修改/修复后的文件，现在就可以提交了。

#### 手动运行 prek 钩子

你也可以使用 `uv` 在所有文件上手动运行 `prek`：

```bash
❯ uv run prek run --all-files
check for added large files..............................................Passed
check toml...............................................................Passed
check yaml...............................................................Passed
fix end of files.........................................................Passed
trim trailing whitespace.................................................Passed
ruff.....................................................................Passed
ruff-format..............................................................Passed
biome check..............................................................Passed
```

## URL

生产或预发布环境的 URL 使用相同的路径，但使用你自己的域名。

### 开发 URL

开发 URL，用于本地开发。

前端：<http://localhost:5173>

后端：<http://localhost:8000>

自动交互式文档（Scalar）：<http://localhost:8000/scalar>

自动备用文档（ReDoc）：<http://localhost:8000/redoc>

Traefik UI：<http://localhost:8090>

### 配置 `localhost.tiangolo.com` 后的开发 URL

开发 URL，用于本地开发。

前端：<http://dashboard.localhost.tiangolo.com>

后端：<http://api.localhost.tiangolo.com>

自动交互式文档（Scalar）：<http://api.localhost.tiangolo.com/scalar>

自动备用文档（ReDoc）：<http://api.localhost.tiangolo.com/redoc>

Traefik UI：<http://localhost.tiangolo.com:8090>
