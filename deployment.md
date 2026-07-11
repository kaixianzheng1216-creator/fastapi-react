# FastAPI 项目 - 部署

你可以使用 Docker Compose 将项目部署到远程服务器。

本项目假定你已有一个 Traefik 代理，用于处理外部通信和 HTTPS 证书。

你可以使用 CI/CD（持续集成与持续部署）系统来实现自动部署，项目中已包含使用 GitHub Actions 进行部署的配置。

不过，你需要先完成几项配置。🤓

## 准备工作

* 准备好一台可用的远程服务器。
* 将你域名的 DNS 记录指向刚刚创建的服务器 IP。
* 为你的域名配置通配符子域名，以便为不同的服务使用多个子域名，例如 `*.fastapi-project.example.com`。这将用于访问不同的组件，比如 `dashboard.fastapi-project.example.com`、`api.fastapi-project.example.com`、`traefik.fastapi-project.example.com`、`adminer.fastapi-project.example.com` 等。也用于 `staging` 环境，例如 `dashboard.staging.fastapi-project.example.com`、`adminer.staging.fastapi-project.example.com` 等。
* 在远程服务器上安装并配置 [Docker](https://docs.docker.com/engine/install/)（Docker Engine，而非 Docker Desktop）。

## 公共 Traefik

我们需要一个 Traefik 代理来处理外部连接和 HTTPS 证书。

下面的步骤只需要执行一次。

### Traefik Docker Compose

* 在远程服务器上创建一个目录，用于存放 Traefik 的 Docker Compose 文件：

```bash
mkdir -p /root/code/traefik-public/
```

将 Traefik 的 Docker Compose 文件复制到你的服务器。你可以在本地终端通过 `rsync` 命令完成：

```bash
rsync -a compose.traefik.yml root@your-server.example.com:/root/code/traefik-public/
```

### Traefik 公共网络

此 Traefik 期望与一个名为 `traefik-public` 的 Docker "公共网络" 通信，以与你的各个栈对接。

这样就只会有一个公共的 Traefik 代理负责与外部世界通信（HTTP 和 HTTPS），在该代理之后，你可以部署一个或多个使用不同域名的栈，即便它们部署在同一台服务器上。

在远程服务器上执行以下命令，创建名为 `traefik-public` 的 Docker 公共网络：

```bash
docker network create traefik-public
```

### Traefik 环境变量

Traefik 的 Docker Compose 文件在启动前需要先在终端中设置一些环境变量。你可以在远程服务器上执行以下命令完成设置。

* 设置 HTTP Basic Auth 的用户名，例如：

```bash
export USERNAME=admin
```

* 设置 HTTP Basic Auth 的密码环境变量，例如：

```bash
export PASSWORD=changethis
```

* 使用 openssl 生成 HTTP Basic Auth 密码的"哈希"版本，并存入环境变量：

```bash
export HASHED_PASSWORD=$(openssl passwd -apr1 $PASSWORD)
```

要确认哈希密码是否正确，可以打印它：

```bash
echo $HASHED_PASSWORD
```

* 设置服务器域名的环境变量，例如：

```bash
export DOMAIN=fastapi-project.example.com
```

* 设置 Let's Encrypt 邮箱的环境变量，例如：

```bash
export EMAIL=admin@example.com
```

**注意**：你需要使用一个真实可用的邮箱，`@example.com` 这种邮箱无法使用。

### 启动 Traefik Docker Compose

在远程服务器上进入你之前复制 Traefik Docker Compose 文件的目录：

```bash
cd /root/code/traefik-public/
```

环境变量设置完毕、`compose.traefik.yml` 就位后，执行以下命令启动 Traefik Docker Compose：

```bash
docker compose -f compose.traefik.yml up -d
```

## 部署 FastAPI 项目

现在 Traefik 已就位，你可以使用 Docker Compose 部署 FastAPI 项目。

**注意**：你也可以直接跳到关于使用 GitHub Actions 进行持续部署的小节。

## 复制代码

```bash
rsync -av --filter=":- .gitignore" ./ root@your-server.example.com:/root/code/app/
```

注意：`--filter=":- .gitignore"` 让 `rsync` 遵循与 git 相同的规则，忽略 git 忽略的文件，例如 Python 虚拟环境。

## 环境变量

你需要先设置一些环境变量。

### 生成密钥

`.env` 文件中部分环境变量的默认值为 `changethis`。

你需要用密钥替换它们。生成密钥可以执行以下命令：

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

复制输出内容，将其作为密码/密钥使用。再运行一次，生成另一个安全的密钥。

### 必需的环境变量

设置 `ENVIRONMENT`，默认为 `local`（用于开发），部署到服务器时通常使用 `staging` 或 `production`：

```bash
export ENVIRONMENT=production
```

设置 `DOMAIN`，默认为 `localhost`（用于开发），部署时应使用你自己的域名，例如：

```bash
export DOMAIN=fastapi-project.example.com
```

将 `POSTGRES_PASSWORD` 设置为与 `changethis` 不同的值：

```bash
export POSTGRES_PASSWORD="changethis"
```

设置 `SECRET_KEY`，用于对 token 进行签名：

```bash
export SECRET_KEY="changethis"
```

注意：你可以使用上面提到的 Python 命令来生成一个安全的密钥。

将 `FIRST_SUPER_USER_PASSWORD` 设置为与 `changethis` 不同的值：

```bash
export FIRST_SUPERUSER_PASSWORD="changethis"
```

将 `BACKEND_CORS_ORIGINS` 设置为包含你的域名：

```bash
export BACKEND_CORS_ORIGINS="https://dashboard.${DOMAIN?Variable not set},https://api.${DOMAIN?Variable not set}"
```

你还可以设置其他一些环境变量：

* `PROJECT_NAME`：项目名称，在 API 的文档和邮件中使用。
* `STACK_NAME`：栈名称，用于 Docker Compose 标签和项目名，`staging`、`production` 等不同环境应使用不同的值。你可以将域名中的点替换为中划线来使用，例如 `fastapi-project-example-com` 和 `staging-fastapi-project-example-com`。
* `BACKEND_CORS_ORIGINS`：允许的 CORS 来源列表，多个值以逗号分隔。
* `FIRST_SUPERUSER`：第一个超级用户的邮箱，该超级用户可以创建新用户。
* `SMTP_HOST`：发送邮件的 SMTP 服务器主机名，通常来自你的邮件服务商（例如 Mailgun、Sparkpost、Sendgrid 等）。
* `SMTP_USER`：发送邮件的 SMTP 服务器用户。
* `SMTP_PASSWORD`：发送邮件的 SMTP 服务器密码。
* `EMAILS_FROM_EMAIL`：用于发送邮件的邮箱账号。
* `POSTGRES_SERVER`：PostgreSQL 服务器的主机名。可以保留默认值 `db`，由同一个 Docker Compose 提供。除非你使用第三方服务，否则通常不需要修改。
* `POSTGRES_PORT`：PostgreSQL 服务器的端口。可以保留默认值。除非你使用第三方服务，否则通常不需要修改。
* `POSTGRES_USER`：Postgres 用户，可以保留默认值。
* `POSTGRES_DB`：本应用使用的数据库名。可以保留默认值 `app`。
* `SENTRY_DSN`：Sentry 的 DSN（如果使用了 Sentry）。

## GitHub Actions 环境变量

还有一些仅由 GitHub Actions 使用的环境变量，你可以自行配置：

* `LATEST_CHANGES`：由 GitHub Action [latest-changes](https://github.com/tiangolo/latest-changes) 使用，用于根据已合并的 PR 自动添加发布说明。它是一个个人访问令牌，详情请查阅相关文档。
* `SMOKESHOW_AUTH_KEY`：用于通过 [Smokeshow](https://github.com/samuelcolvin/smokeshow) 处理和发布代码覆盖率，按照其说明创建一个（免费）的 Smokeshow 密钥。

### 使用 Docker Compose 部署

环境变量设置完毕后，就可以使用 Docker Compose 部署：

```bash
cd /root/code/app/
docker compose -f compose.yml build
docker compose -f compose.yml up -d
```

在生产环境中，你不希望使用 `compose.override.yml` 中的覆盖配置，因此这里显式指定使用 `compose.yml` 作为要使用的文件。

## 持续部署（CD）

你可以使用 GitHub Actions 来自动部署项目。😎

你可以部署多个环境。

已经预先配置好了两个环境，`staging` 和 `production`。🚀

### 安装 GitHub Actions Runner

* 在远程服务器上，为 GitHub Actions 创建一个用户：

```bash
sudo adduser github
```

* 为 `github` 用户授予 Docker 权限：

```bash
sudo usermod -aG docker github
```

* 临时切换到 `github` 用户：

```bash
sudo su - github
```

* 进入 `github` 用户的家目录：

```bash
cd
```

* 按照官方指南[安装一个 GitHub Action 自托管 runner](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/adding-self-hosted-runners#adding-a-self-hosted-runner-to-a-repository)。

* 当询问标签时，添加一个对应环境的标签，例如 `production`。你也可以稍后再添加。

按照指南安装完成后，会提示你运行一个命令来启动 runner。但该进程会随着你结束该进程或与服务器的本地连接断开而停止。

为了确保它在启动时运行并持续保持运行，可以将其作为服务安装。为此，退出 `github` 用户，回到 `root` 用户：

```bash
exit
```

执行后将回到之前的用户，并处于该用户所属的目录。

在进入 `github` 用户的目录之前，你需要先切换为 `root` 用户（你可能已经是了）：

```bash
sudo su
```

* 以 `root` 用户身份，进入 `github` 用户家目录下的 `actions-runner` 目录：

```bash
cd /home/github/actions-runner
```

* 使用 `github` 用户将自托管 runner 安装为服务：

```bash
./svc.sh install github
```

* 启动该服务：

```bash
./svc.sh start
```

* 查看服务状态：

```bash
./svc.sh status
```

你可以在官方指南中阅读更多内容：[将自托管 runner 应用配置为服务](https://docs.github.com/en/actions/hosting-your-own-runners/managing-self-hosted-runners/configuring-the-self-hosted-runner-application-as-a-service)。

### 配置 GitHub Environments

部署工作流使用 [GitHub Environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) 来管理 `staging` 和 `production`。它支持环境特定的密钥、部署保护规则（例如必需的审阅者、等待计时器）以及部署状态跟踪。

要配置它们，请进入你仓库的 **Settings** > **Environments**，创建 `staging` 和 `production` 环境。

### 设置密钥

对于每个 GitHub Environment（`staging` 和 `production`），按照 [environment secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#creating-secrets-for-an-environment) 的方式配置所需的密钥。推荐使用环境密钥，而不是 [repository secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets#creating-secrets-for-a-repository)，因为前者作用域限定在特定环境中，能够降低暴露风险，并与配置的保护规则保持一致。

当前的 GitHub Actions 工作流需要以下密钥：

* `DOMAIN_PRODUCTION`
* `DOMAIN_STAGING`
* `STACK_NAME_PRODUCTION`
* `STACK_NAME_STAGING`
* `EMAILS_FROM_EMAIL`
* `FIRST_SUPERUSER`
* `FIRST_SUPERUSER_PASSWORD`
* `POSTGRES_PASSWORD`
* `SECRET_KEY`
* `LATEST_CHANGES`
* `SMOKESHOW_AUTH_KEY`

## GitHub Action 部署工作流

`.github/workflows` 目录中已经配置了用于部署到各环境的 GitHub Action 工作流（具有相应标签的 GitHub Actions runners）：

* `staging`：在推送（或合并）到 `master` 分支后触发。
* `production`：在发布 release 后触发。

两个工作流都与各自的 GitHub Environment 关联，因此部署信息会显示在仓库的 **Environments** 部分，并遵循你配置的任何保护规则。

如果你需要添加其他环境，可以以此作为起点进行扩展。

## URL

将 `fastapi-project.example.com` 替换为你的域名。

### 主 Traefik 控制台

Traefik UI：`https://traefik.fastapi-project.example.com`

### 生产环境

前端：`https://dashboard.fastapi-project.example.com`

后端 API 文档：`https://api.fastapi-project.example.com/docs`

后端 API 基础 URL：`https://api.fastapi-project.example.com`

Adminer：`https://adminer.fastapi-project.example.com`

### Staging 环境

前端：`https://dashboard.staging.fastapi-project.example.com`

后端 API 文档：`https://api.staging.fastapi-project.example.com/docs`

后端 API 基础 URL：`https://api.staging.fastapi-project.example.com`

Adminer：`https://adminer.staging.fastapi-project.example.com`
