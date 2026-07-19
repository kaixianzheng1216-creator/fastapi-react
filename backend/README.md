# FastAPI 项目 - 后端

## 环境要求

* [Docker](https://www.docker.com/)。
* [uv](https://docs.astral.sh/uv/) 用于 Python 包和环境管理。

## Docker Compose

按照 [../docs/development.md](../docs/FastAPI%20项目%20-%20开发指南.md) 中的指南，使用 Docker Compose 启动本地开发环境。

## 一般工作流

默认情况下，依赖由 [uv](https://docs.astral.sh/uv/) 管理，请前往该网站安装它。

在 `./backend/` 目录下，你可以使用以下命令安装所有依赖：

```console
$ uv sync
```

然后，你可以使用以下命令激活虚拟环境：

```console
$ source .venv/bin/activate
```

请确保编辑器使用项目根目录下的虚拟环境。Linux/macOS 的解释器路径为 `.venv/bin/python`，Windows 为 `.venv/Scripts/python.exe`。

后端按业务领域组织在 `./backend/app/modules/`。每个领域自行维护 `router.py`、`models.py`、`schemas.py` 和 `service.py`；数据库 Engine 与模型注册入口位于 `./backend/app/db/`。

## VS Code

已经预先配置好通过 VS Code 调试器运行后端，这样你就可以使用断点、暂停并查看变量等。

相关设置也已配置完毕，你可以通过 VS Code 的 Python 测试面板运行测试。

## Docker Compose 覆盖配置

在开发过程中，你可以在 `compose.override.yml` 文件中修改仅影响本地开发环境的 Docker Compose 设置。

对该文件的修改仅影响本地开发环境，不会影响生产环境。因此，你可以添加有助于开发工作流的"临时"更改。

例如，包含后端代码的目录会在 Docker 容器内同步，将你修改的代码实时复制到容器内的目录中。这样你就可以立即测试你的更改，而无需重新构建 Docker 镜像。这种方式只应在开发阶段使用；生产环境应该使用包含最新后端代码的 Docker 镜像来构建。但在开发阶段，它能让你非常快速地迭代。

还有一个命令覆盖配置，它运行 `uvicorn app.main:app --reload`。它启动单个服务器进程（而不是像生产环境那样启动多个进程），并在代码更改时重新加载进程。请注意，如果你有语法错误并保存了 Python 文件，进程会中断并退出，容器也会停止。之后，你可以通过修复错误并重新运行来重启容器：

```console
$ docker compose watch
```

还有一个被注释掉的 `command` 覆盖配置，你可以取消注释它并注释掉默认的那个。它会使后端容器运行一个“什么也不做”的进程，但保持容器处于运行状态。这允许你进入正在运行的容器内部执行命令，例如使用 Python 解释器测试已安装的依赖，或启动在检测到更改时自动重新加载的开发服务器。

要使用 `bash` 会话进入容器，你可以先启动整个服务栈：

```console
$ docker compose watch
```

然后在另一个终端中，使用 `exec` 命令进入正在运行的容器：

```console
$ docker compose exec backend bash
```

你应该会看到类似下面的输出：

```console
root@7f2607af31c3:/app/backend#
```

这表示你已经进入容器内的 `bash` 会话，以 `root` 用户身份位于 `/app/backend`，应用代码位于 `/app/backend/app`。

在该目录下，你可以使用 `uvicorn app.main:app --reload` 命令运行带调试功能的实时重载服务器。

```console
$ uvicorn app.main:app --reload
```

它的效果看起来像这样：

```console
root@7f2607af31c3:/app/backend# uvicorn app.main:app --reload
```

然后按回车键。这会启动一个实时重载的服务器，在检测到代码更改时自动重新加载。

不过，如果没有检测到更改，而是出现了语法错误，它会直接停止并报错。但因为容器仍然处于运行状态，而且你处于一个 Bash 会话中，所以你可以在修复错误后，通过运行相同的命令（按“上箭头”和“回车”）快速重启它。

……正是上述这个特性让“让容器保持运行但什么都不做，然后在 Bash 会话中启动实时重载服务器”这种做法变得非常有用。

## 数据库迁移

本地开发时，整个 `backend` 目录会同步到容器，因此可以在容器内运行 Alembic，生成的迁移文件会保存在 `backend/alembic/versions/` 并同步回宿主机。

请确保每次修改模型时，都为模型创建一个 "revision"（版本），并使用该 "revision" 来 "upgrade"（升级）你的数据库。因为这才会真正更新数据库中的表。否则，你的应用程序会出错。

* 在后端容器中启动一个交互式会话：

```console
$ docker compose exec backend bash
```

* Alembic 通过 `./backend/app/db/models.py` 注册各领域的 SQLModel 表模型。

* 修改模型之后（例如添加一列），在容器内创建一个 revision，例如：

```console
$ alembic revision --autogenerate -m "Add column last_name to User model"
```

* 将 alembic 目录下生成的文件提交到 git 仓库。

* 创建 revision 之后，在数据库中运行迁移（这一步才会真正更改数据库）：

```console
$ alembic upgrade head
```

不要使用 `SQLModel.metadata.create_all()` 替代迁移，也不要改写已经部署过的 revision。模型发生变化时应新增 revision，并在提交前执行 `alembic check` 和 `alembic upgrade head`。
