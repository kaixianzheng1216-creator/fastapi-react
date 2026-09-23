# 前端按钮规范

## 组件默认样式

- 优先组合已安装的 shadcn 组件，通过 `variant`、`size` 选择外观，不在调用处重写阴影、圆角、颜色及组件内边距。
- 资源卡片复用 `CardHeader`、`CardTitle`、`CardDescription`、`CardAction` 和 `CardFooter`；骨架保持相同结构，操作入口使用 `CardAction` 默认布局。
- 加载失败复用 `Empty` 和 `Button`，与空列表保持一致；重试保留焦点及防重复提交。筛选分组沿用 `FieldSet`、`FieldLegend` 默认间距。
- `className` 保留页面布局、文本截断、响应式滚动和键盘焦点所需规则；不为减少样式而删掉可访问性与交互反馈。

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
统一使用 `value` + `onSearch`，提交裁剪后的关键词。列表支持 300ms 防抖、中文输入及手动提交；知识库内容检索使用 `searchOnChange={false}`，仅在点击或回车时提交。同词手动提交由页面调用 `refetch`。

列表不提供独立的“重置筛选”按钮。清空搜索框移除关键词，筛选项切回“全部”移除该条件；两者均回到第一页，并保留其他条件。统一通过 `SearchToolbar` 和 `useListParams` 处理，不新增重置状态或组件重挂载逻辑。
页面保留自己的 URL 更新、同词重搜和校验：列表搜索允许清空条件；知识库内容搜索
允许空白提交以清除旧结果，移除 URL 中的关键词并恢复初始状态，不发送空检索请求。不要为了复用而复制请求状态到额外的 useState。

Dialog 内「取消 + 提交」的表单底部统一使用 `FormDialogFooter`，提交文案保持固定，
不传加载文案。用于文件/知识库上传、添加网页、库与文件夹编辑、用户创建/编辑、
MCP 密钥编辑和技能创建/上传。取消通过 `DialogClose` 触发父级 `onOpenChange`，
表单重置和提交中禁止关闭仍由父级处理。

使用 `DialogTrigger` 打开的弹窗保留默认焦点恢复。受控弹窗与菜单操作统一使用 `useActionFocus` 记录入口，关闭后恢复焦点；入口已移除或列表正在刷新时，返回该页的创建按钮或目录区域。创建密钥后打开保存配置弹窗时，等最后一个弹窗关闭再恢复焦点。

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

## 管理列表页面

- MCP 接入仅展示当前项目的密钥列表，移除范围切换。创建按钮放在页头，搜索、权限/状态筛选及“接入说明”放在同一工具栏；说明弹窗展示一份连接配置与直接展开的全部工具。只读允许查询已启用知识库和业务数据，读写额外允许维护知识库；前端表单与列表仅保留项目分支。
- 每页只有一个纵向滚动容器，`usePaginationScrollReset` 绑定实际滚动元素。项目管理和用户管理各自由页面负责滚动，列表不再建立独立滚动区。
- 内容区撑满可用高度，分页复用 `PagePagination` 并使用 `mt-auto`。空列表不显示分页。
- 顺序统一为搜索筛选、列表、底部分页。不展示独立的重置入口或“找到 / 共多少条”结果数量提示。
- 当前项目名称仅在侧栏选择器显示，顶部面包屑保留页面与内容层级，不重复添加项目名称。
- 查询展示统一通过 `getQueryViewState` 判断：首次加载显示骨架；无数据的请求失败显示 `LoadError`；重试期间保留错误区域和按钮焦点，避免重新切成骨架。重复点击重试不重复发请求。
- 空列表显示独立 `Empty`，不放进普通表格行；切换搜索或筛选时，上次空结果不能作为新条件的结论，等待期间显示骨架。
- 已有数据刷新时复用 `CollectionContent` / `CardGrid`，保留内容并标记忙碌；`busy` 只控制加载反馈，`inert` 仅用于切换条件时的旧内容。后台刷新不禁用列表，也不打断焦点；同条件刷新失败保留已有数据，使用现有错误通知。
- 知识库搜索与文档预览复用 `ContentSkeleton`；首次错误已有页内提示的查询声明 `handlesInitialError`，不再重复弹出 Toast。
- 同页搜索、筛选和翻页通过 `keepPreviousData` 保留内容及分页，首次进入显示骨架。项目页面由 `ProjectProvider` 按项目 ID 重新挂载，切换项目不展示上一项目的数据。
- 删除后保留当前页；仅当前页最后一项被删除且页码大于 1 时退回上一页。
- 管理列表的分组筛选统一使用 `FieldSet`、`FieldLegend` 和 `ToggleGroup`：标签在上，选项在下，工具栏底部对齐；“全部”表示清除该组条件。
- 简单列表沿用 `Table`，统一行高、主次文字及操作列；不为样式一致引入通用 CRUD 或强制迁移表格引擎。

## UI 与业务边界

- `components/ui` 与公共表单不调用业务 API，不判断项目归属或文件库 / 知识库类型。
- `NameDescriptionDialog`、`NameDialog` 负责字段、校验、提交和关闭交互；业务目录中的组件负责请求、状态和业务提示。
- 库创建和编辑弹窗仅在打开时挂载，关闭时卸载；表单从初始值建立，不叠加 effect 和关闭回调重复重置。
- 数据采集刷新按钮属于后台业务组件，位于 `app/admin/_components`，不作为通用按钮使用。
- `AppHeader` 的面包屑只控制标题布局；左侧使用独立的 `left` 插槽，默认显示侧栏按钮，显式传 `null` 可隐藏。

## 文件组织与可读性

- 页面私有组件放在对应路由的 `_components`；后台多个页面共用的业务组件放在 `app/admin/_components`。
- `page.tsx` 保留路由入口或页面组合，复杂列表实现放在页面私有组件中；不为短小页面强制增加包装层。
- `"use client"`、导入区、类型或常量定义、组件实现之间留空行；外部依赖与应用内导入分组。
- 状态、查询、mutation、事件处理和 JSX 返回之间按逻辑段留一个空行；同组字段和状态连续排列，不逐行加空行。
- 生成的 API 客户端文件由生成器维护，不手工调整排版。
