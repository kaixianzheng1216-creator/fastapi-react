# 前端按钮规范

按钮使用 `components/ui/button.tsx` 的 shadcn variants。异步内容统一使用
`components/common/button-content.tsx`，不在页面中切换加载文案或手写旋转图标。

## 外观与状态

- 带图标：用 `Spinner` 原位替换图标，文字保持不变。
- 纯图标：同样原位替换，并在按钮上保留 `aria-label` 或 Tooltip 提供的可访问名称。
- 纯文字：保留文字占位和可访问名称，居中显示 Spinner，按钮宽度不变。
- 执行中的按钮设置 `disabled` 和 `aria-busy`。关联操作只需禁用，不显示加载动画。
- 仅打开弹窗、切换视图的同步按钮不显示加载态。
- `ButtonContent` 只负责展示；请求、失败提示、重试和防重复执行由业务层负责。
- 优先使用 `variant`、`size` 和默认图标间距，不额外提供图标样式覆盖接口。
- 默认主要操作使用 `default`，次要操作使用 `outline`，危险操作使用 `destructive`；目录工具栏使用 `sm`，搜索和普通表单使用默认尺寸。
- 加载动画统一使用 `Spinner`，遵循系统减少动态效果设置。

## 标准组合

```tsx
// 带图标。icon 接收组件，不要把图标放到 children 中。
<Button disabled={isPending} aria-busy={isPending}>
  <ButtonContent loading={isPending} icon={DownloadIcon}>
    下载
  </ButtonContent>
</Button>

// 纯图标。
<Button size="icon" aria-label="停止生成" disabled={isPending} aria-busy={isPending}>
  <ButtonContent loading={isPending} icon={SquareIcon} />
</Button>

// 纯文字。不需要在 Button 上添加 relative。
<Button type="submit" disabled={isPending} aria-busy={isPending}>
  <ButtonContent loading={isPending}>保存</ButtonContent>
</Button>
```

## 搜索与表单

搜索统一使用 `SearchToolbar`，传入 `isPending`，表单字段名为 `search`。
页面保留自己的 URL 更新、同词重搜和校验：列表搜索允许清空条件，知识库内容搜索
使用 `required` 并拒绝纯空白词。不要为了复用而复制请求状态到额外的 useState。

Dialog 内「取消 + 提交」的表单底部统一使用 `FormDialogFooter`，提交文案保持固定，
不传加载文案。用于文件/知识库上传、添加网页、库与文件夹编辑、用户创建/编辑、
MCP 密钥编辑和技能创建/上传。取消通过 `DialogClose` 触发父级 `onOpenChange`，
表单重置和提交中禁止关闭仍由父级处理。

删除确认使用 `AlertDialog`；移动文件、仅保存或仅关闭的底部按各自语义组合，
其中异步按钮复用 `ButtonContent`，不为这些差异给 `FormDialogFooter` 增加配置分支。

验收覆盖慢请求、失败后恢复、重复提交、键盘操作、移动端可访问名称、按钮宽度与深浅色。

## 目录、滚动与内容

- 文件库和知识库的工具栏共用 `DirectoryToolbar`，选择数量可见，删除仍需确认。
- 菜单内异步操作执行时，在对应行的操作入口展示 `ButtonContent` 加载态；通过 mutation 的目标 ID 定位当前行。关联操作只禁用。
- 表格横向滚动间距由 `Table` 统一提供；目录表格纵向滚动容器使用 `scroll-content-y`，避免在外层重复补 padding。
- 上传列表高度使用有下限的视口比例，矮窗口允许弹窗整体滚动，文件列表不能折叠为零。
- `MarkdownContent` 统一表格列宽、表头换行和横向滚动间距；页面只决定内容高度限制。
- 文件库和知识库上传共用 `uploadFiles` 的大小校验、每批 3 个文件与错误结果处理；类型限制、上传接口和业务成功提示由调用方负责。
- 两类上传的文件传输与确认共用 `transferDocumentUpload`；传输失败清理记录，确认失败保留记录，页面只接入各自的完成与删除接口。

## 聊天按钮与复制

- `TooltipIconButton` 默认使用 `icon-sm`，尊重传入的 `size` 和 `variant`，不再叠加尺寸、颜色和按压缩放覆盖。
- 复制共用 `useCopyToClipboard`：等待时禁用并显示 Spinner，成功后显示勾选图标，3 秒后恢复；文字按钮保留原文案，纯图标按钮同步更新提示。
- 运行中工具、待办和 Toast 使用公共 `Spinner`，统一遵循减少动态效果设置。
