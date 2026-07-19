# FastAPI 项目 - 后端

## 环境要求

* [Docker](https://www.docker.com/)。
* [uv](https://docs.astral.sh/uv/) 用于 Python 包和环境管理。

## Docker Compose

按照 [../development.md](../development.md) 中的指南，使用 Docker Compose 启动本地开发环境。

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

请确保你的编辑器使用的是正确的 Python 虚拟环境，解释器路径为 `backend/.venv/bin/python`。

在 `./backend/app/models.py` 中修改或添加数据与 SQL 表的 SQLModel 模型，在 `./backend/app/api/` 中添加 API 端点，在 `./backend/app/crud.py` 中添加 CRUD（增删改查）工具函数。

## VS Code

已经预先配置好通过 VS Code 调试器运行后端，这样你就可以使用断点、暂停并查看变量等。

相关设置也已配置完毕，你可以通过 VS Code 的 Python 测试面板运行测试。

## Docker Compose 覆盖配置

在开发过程中，你可以在 `compose.override.yml` 文件中修改仅影响本地开发环境的 Docker Compose 设置。

对该文件的修改仅影响本地开发环境，不会影响生产环境。因此，你可以添加有助于开发工作流的"临时"更改。

例如，包含后端代码的目录会在 Docker 容器内同步，将你修改的代码实时复制到容器内的目录中。这样你就可以立即测试你的更改，而无需重新构建 Docker 镜像。这种方式只应在开发阶段使用；生产环境应该使用包含最新后端代码的 Docker 镜像来构建。但在开发阶段，它能让你非常快速地迭代。

还有一个命令覆盖配置，它运行 `fastapi run --reload` 而不是默认的 `fastapi run`。它启动单个服务器进程（而不是像生产环境那样启动多个进程），并在代码更改时重新加载进程。请注意，如果你有语法错误并保存了 Python 文件，进程会中断并退出，容器也会停止。之后，你可以通过修复错误并重新运行来重启容器：

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
root@7f2607af31c3:/app#
```

这表示你已经进入了容器内的 `bash` 会话，以 `root` 用户身份，位于 `/app` 目录下。该目录下还有一个名为 "app" 的子目录，那就是你的代码在容器内所在的位置：`/app/app`。

在该目录下，你可以使用 `fastapi run --reload` 命令运行带调试功能的实时重载服务器。

```console
$ fastapi run --reload app/main.py
```

它的效果看起来像这样：

```console
root@7f2607af31c3:/app# fastapi run --reload app/main.py
```

然后按回车键。这会启动一个实时重载的服务器，在检测到代码更改时自动重新加载。

不过，如果没有检测到更改，而是出现了语法错误，它会直接停止并报错。但因为容器仍然处于运行状态，而且你处于一个 Bash 会话中，所以你可以在修复错误后，通过运行相同的命令（按“上箭头”和“回车”）快速重启它。

……正是上述这个特性让“让容器保持运行但什么都不做，然后在 Bash 会话中启动实时重载服务器”这种做法变得非常有用。

## 后端测试

要测试后端，请运行：

```console
$ bash ./scripts/test.sh
```

测试使用 Pytest 运行，你可以修改 `./backend/tests/` 下的测试并添加新的测试。

如果你使用 GitHub Actions，测试会自动运行。

### 在运行中的服务栈中运行测试

如果你的服务栈已经启动，而你只想运行测试，可以使用：

```bash
docker compose exec backend bash scripts/tests-start.sh
```

`/app/scripts/tests-start.sh` 这个脚本会在确保整个服务栈其余部分都在运行之后调用 `pytest`。如果你需要向 `pytest` 传递额外的参数，可以将它们传递给上面的命令，它们会被转发过去。

例如，要在遇到第一个错误时停止：

```bash
docker compose exec backend bash scripts/tests-start.sh -x
```

### 测试覆盖率

测试运行后，会生成一个 `htmlcov/index.html` 文件，你可以在浏览器中打开它查看测试覆盖率。

## 数据库迁移

由于在本地开发期间，你的 app 目录是以卷的形式挂载到容器中的，所以你也可以在容器内使用 `alembic` 命令运行迁移，迁移代码会保存在你的 app 目录中（而不是仅仅保存在容器内）。这样你就可以将其加入 git 仓库。

请确保每次修改模型时，都为模型创建一个 "revision"（版本），并使用该 "revision" 来 "upgrade"（升级）你的数据库。因为这才会真正更新数据库中的表。否则，你的应用程序会出错。

* 在后端容器中启动一个交互式会话：

```console
$ docker compose exec backend bash
```

* Alembic 已经预先配置好，可以从 `./backend/app/models.py` 导入你的 SQLModel 模型。

* 修改模型之后（例如添加一列），在容器内创建一个 revision，例如：

```console
$ alembic revision --autogenerate -m "Add column last_name to User model"
```

* 将 alembic 目录下生成的文件提交到 git 仓库。

* 创建 revision 之后，在数据库中运行迁移（这一步才会真正更改数据库）：

```console
$ alembic upgrade head
```

如果你根本不想使用迁移，可以打开 `./backend/app/core/db.py` 文件中以以下内容结尾的代码行的注释：

```python
SQLModel.metadata.create_all(engine)
```

并注释掉 `scripts/prestart.sh` 文件中包含以下内容的代码行：

```console
$ alembic upgrade head
```

如果你不想从默认模型开始，而是想从一开始就删除或修改它们，又不想保留任何已有的 revision，可以删除 `./backend/alembic/versions/` 下的所有 revision 文件（`.py` Python 文件）。然后按照上面描述的方法创建第一个迁移。

## 邮件模板

邮件模板位于 `./backend/app/integrations/email/templates/`。这里有两个目录：`build` 和 `src`。`src` 目录包含用于构建最终邮件模板的源文件，`build` 目录包含应用程序实际使用的最终邮件模板。

在继续之前，请确保你已在 VS Code 中安装 [MJML 扩展](https://github.com/mjmlio/vscode-mjml)。

安装好 MJML 扩展后，你就可以在 `src` 目录中创建新的邮件模板。创建好新的邮件模板并在编辑器中打开 `.mjml` 文件后，使用 `Ctrl+Shift+P` 打开命令面板，搜索 `MJML: Export to HTML`。这会将 `.mjml` 文件转换为 `.html` 文件，然后你就可以将其保存到 build 目录中。
