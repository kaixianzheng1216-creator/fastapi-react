# 贡献指南

感谢你有兴趣为 Full Stack FastAPI Template 做出贡献！🙇

## 优先讨论

对于**较大的改动**（新功能、架构变更、较大的重构），请先发起一个 [GitHub Discussion](https://github.com/fastapi/full-stack-fastapi-template/discussions)。这样社区和维护者可以在你投入大量时间实现之前，先对方案给出反馈。

对于较小的、直接的改动，你可以直接提交 Pull Request，无需先发起讨论。这包括：

- 错别字和语法修正
- 小的可复现的 bug 修复
- 修复 lint 警告或类型错误
- 微小的代码改进（例如，删除无用代码）

请注意，非团队成员的 PR 不允许修改 `pyproject.toml` 或 `uv.lock`，以防止供应链风险。
如果你想新增依赖，请创建一个新的 [Discussion](https://github.com/fastapi/full-stack-fastapi-template/discussions) 来说明原因。

## 开发

有关搭建开发环境、运行整个应用栈、lint 检查、pre-commit 钩子等的详细说明，请参阅 [开发指南](development.md)。

## Pull Request

提交 Pull Request 时：

1. 提交前确保所有测试通过。
2. 保持 PR 专注于单一改动。
3. 如果你修改了功能，请同步更新测试。
4. 在 PR 描述中引用任何相关 issue。

## 自动化代码与 AI

我们鼓励你使用一切你想要的工具来完成工作并尽可能高效地贡献，这包括 AI（LLM）工具等。不过，贡献应当具有有意义的**人工参与**、判断、上下文等。

如果一个 PR 中投入的**人力**（例如编写 LLM prompt）**少于**我们在**审阅它**时需要投入的**精力**，请**不要**提交该 PR。

可以这样想：我们自己也可以写 LLM prompt 或运行自动化工具，这会比审阅外部 PR 更快。

### 关闭自动化与 AI 生成的 PR

如果我们看到看起来是以类似方式由 AI 生成或自动化的 PR，我们会将其标记并关闭。

同样的规则也适用于评论和描述，请不要直接复制粘贴 LLM 生成的内容。

### 人力拒绝服务攻击

使用自动化工具和 AI 提交需要我们仔细审阅和处理的 PR 或评论，相当于对我们的人力发起了一次[拒绝服务攻击](https://en.wikipedia.org/wiki/Denial-of-service_attack)。

提交 PR 的人几乎不费什么力气（一个 LLM prompt），却会在我们这边产生大量工作量（仔细审阅代码）。

请不要这样做。

对于反复向我们发送自动化 PR 或评论的账号，我们将不得不进行封禁。

### 明智地使用工具

正如 Uncle Ben 所说：

> 伴随着强大的 ~~力量~~ **工具**，而来的是重大的责任。

请避免无意中造成伤害。

你手边有很棒的工具，明智地使用它们来真正提供帮助。

## 有疑问？

如果你对贡献有任何疑问，欢迎发起一个 [GitHub Discussion](https://github.com/fastapi/full-stack-fastapi-template/discussions)。
