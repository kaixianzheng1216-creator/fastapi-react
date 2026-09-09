"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarItemButton } from "@/app/(authenticated)/_components/sidebar-item-button";
import {
  type ConversationKind,
  useNewConversationKind,
} from "@/app/conversation-kind";
import { searchConversations } from "@/lib/conversation-thread-list-adapter";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import {
  AuiIf,
  ThreadListItemMorePrimitive,
  ThreadListItemPrimitive,
  ThreadListPrimitive,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArchiveIcon,
  CornerUpLeftIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PuzzleIcon,
  SearchIcon,
  SquarePenIcon,
  TrashIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  forwardRef,
  Fragment,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type FC,
  type SubmitEvent,
} from "react";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getApiErrorMessage } from "@/lib/api-error";
import {
  agentArchiveConversation,
  agentDeleteConversation,
  agentRenameConversation,
} from "@/lib/client";
import { toast } from "sonner";

const SEARCH_DEBOUNCE_MS = 300;
const DAY_IN_MS = 86_400_000;

const formatConversationTime = (updatedAt: string): string => {
  const date = new Date(updatedAt);
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  if (date.getTime() >= startOfToday) return time;
  if (date.getTime() >= startOfToday - DAY_IN_MS) return `昨天 ${time}`;

  return `${new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
  }).format(date)} ${time}`;
};

export const ThreadList: FC = () => {
  const pathname = usePathname();

  return (
    <ThreadListRoot>
      <ThreadListSearch />
      <ThreadListNew />
      <ThreadListNew kind="research" />
      <SidebarItemButton
        asChild
        isActive={pathname.startsWith("/skills")}
        aria-label="技能"
      >
        <Link href="/skills">
          <PuzzleIcon />
          <span>技能</span>
        </Link>
      </SidebarItemButton>
      <ThreadListItems />
    </ThreadListRoot>
  );
};

export const ThreadListSearch: FC<{
  archived?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}> = ({ archived = false, open: controlledOpen, onOpenChange }) => {
  const aui = useAui();
  const router = useRouter();
  const { select: selectNewKind } = useNewConversationKind();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [search, setSearch] = useState("");
  const open = controlledOpen ?? uncontrolledOpen;

  function setOpen(value: boolean): void {
    setUncontrolledOpen(value);
    onOpenChange?.(value);
  }

  function createNewThread(kind: ConversationKind): void {
    selectNewKind(kind);

    aui.threads.switchToNewThread();

    router.replace("/");

    setOpen(false);
  }

  return (
    <>
      {!archived && (
        <Button
          variant="outline"
          className="bg-muted/25 text-muted-foreground hover:text-muted-foreground justify-start font-normal"
          onClick={() => setOpen(true)}
        >
          <SearchIcon />
          搜索对话…
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80dvh] overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{archived ? "已归档对话" : "搜索对话"}</DialogTitle>
            <DialogDescription>
              {archived ? "查看已归档的对话" : "搜索已有对话"}
            </DialogDescription>
          </DialogHeader>
          <Command
            shouldFilter={false}
            className="**:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          >
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={archived ? "搜索已归档对话" : "搜索对话"}
            />
            <CommandList className="max-h-[calc(80dvh-3rem)]">
              {!archived && !search && (
                <CommandGroup heading="快捷创建">
                  <CommandItem
                    onSelect={() => createNewThread("chat")}
                  >
                    <SquarePenIcon />
                    新对话
                  </CommandItem>
                  <CommandItem
                    onSelect={() => createNewThread("research")}
                  >
                    <SearchIcon />
                    新调研
                  </CommandItem>
                </CommandGroup>
              )}
              <ThreadListSearchResults
                archived={archived}
                searchQuery={search.trim()}
                onSelect={() => setOpen(false)}
              />
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
};

export const ThreadListRoot: FC<
  ComponentPropsWithoutRef<typeof ThreadListPrimitive.Root>
> = ({ className, ...props }) => {
  return (
    <ThreadListPrimitive.Root
      data-slot="aui_thread-list-root"
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
};

export const ThreadListItems: FC<ComponentPropsWithoutRef<"div">> = ({
  className,
  ...props
}) => {
  return (
    <div
      data-slot="aui_thread-list-items"
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    >
      <AuiIf
        condition={(s) =>
          !s.threads.isLoading && s.threads.threadIds.length === 0
        }
      >
        <Empty>
          <EmptyHeader>
            <EmptyTitle>暂无可显示内容</EmptyTitle>
          </EmptyHeader>
        </Empty>
      </AuiIf>
      <AuiIf
        condition={(s) =>
          s.threads.isLoading && s.threads.threadIds.length === 0
        }
      >
        <ThreadListSkeleton />
      </AuiIf>
      <AuiIf
        condition={(s) =>
          !s.threads.isLoading || s.threads.threadIds.length > 0
        }
      >
        <ThreadListItemGroups />
      </AuiIf>
    </div>
  );
};

const dateGroupLabel = (
  date: Date | undefined,
  startOfToday: number,
): string => {
  if (!date || date.getTime() >= startOfToday) return "今天";
  if (date.getTime() >= startOfToday - DAY_IN_MS) return "昨天";
  return "更早";
};

type ThreadListGroup = { label: string; indices: number[] };

const ThreadListItemGroups: FC = () => {
  const threadIds = useAuiState((s) => s.threads.threadIds);
  const threadItems = useAuiState((s) => s.threads.threadItems);

  const groups = useMemo(() => {
    const itemsById = new Map(threadItems.map((item) => [item.id, item]));
    const dates = threadIds.map((id) => itemsById.get(id)?.lastMessageAt);
    const indices = threadIds.map((_, index) => index);

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    const time = (index: number) =>
      dates[index]?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const sorted = [...indices].sort((a, b) => time(b) - time(a));

    const result: ThreadListGroup[] = [];
    for (const index of sorted) {
      const label = dateGroupLabel(dates[index], startOfToday);
      const lastGroup = result[result.length - 1];
      if (lastGroup?.label === label) {
        lastGroup.indices.push(index);
      } else {
        result.push({ label, indices: [index] });
      }
    }
    return result;
  }, [threadIds, threadItems]);

  return groups.map((group) => (
    <Fragment key={group.label}>
      <div
        data-slot="aui_thread-list-group-label"
        className="text-muted-foreground px-2.5 pt-3 pb-1 text-xs font-medium"
      >
        {group.label}
      </div>
      {group.indices.map((index) => (
        <ThreadListPrimitive.ItemByIndex
          key={threadIds[index]}
          index={index}
          components={{ ThreadListItem }}
        />
      ))}
    </Fragment>
  ));
};

export const ThreadListSearchResults: FC<{
  archived?: boolean;
  searchQuery: string;
  onSelect: () => void;
}> = ({ archived = false, searchQuery, onSelect }) => {
  const aui = useAui();
  const router = useRouter();
  const [debouncedSearchQuery] = useDebounce(searchQuery, SEARCH_DEBOUNCE_MS);

  const conversationsQuery = useQuery({
    queryKey: ["conversations", "search", debouncedSearchQuery, archived],
    queryFn: ({ signal }) =>
      searchConversations(debouncedSearchQuery || undefined, archived, signal),
  });

  if (
    searchQuery !== debouncedSearchQuery ||
    (conversationsQuery.isFetching && !conversationsQuery.data)
  ) {
    return <ThreadListSkeleton />;
  }

  if (!conversationsQuery.data?.length) {
    return <CommandEmpty>暂无可显示内容</CommandEmpty>;
  }

  return (
    <>
      <CommandGroup
        heading={
          searchQuery ? "搜索结果" : archived ? "已归档对话" : "最近对话"
        }
      >
        {conversationsQuery.data.map((conversation) => (
          <CommandItem
            key={conversation.id}
            className="group"
            value={`${conversation.title} ${conversation.id}`}
            onSelect={() => {
              aui.threads.switchToThread(conversation.id);
              router.replace("/");
              onSelect();
            }}
          >
            {conversation.kind === "research" ? (
              <SearchIcon />
            ) : (
              <MessageCircleIcon />
            )}
            <span className="min-w-0 flex-1 truncate">
              {conversation.title}
            </span>
            <span className="text-muted-foreground text-xs group-hover:hidden">
              {formatConversationTime(conversation.updatedAt)}
            </span>
            <CornerUpLeftIcon className="hidden group-hover:block" />
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );
};

type ThreadListNewProps = ComponentPropsWithoutRef<
  typeof SidebarItemButton
> & {
  kind?: ConversationKind;
};

export const ThreadListNew = forwardRef<HTMLButtonElement, ThreadListNewProps>(
  ({ kind = "chat", className, children, onClick, ...props }, ref) => {
    const aui = useAui();
    const pathname = usePathname();
    const router = useRouter();
    const { kind: selectedKind, select: selectNewKind } =
      useNewConversationKind();
    const isNewThread = useAuiState(
      (state) => state.threads.newThreadId === state.threads.mainThreadId,
    );
    const Icon = kind === "research" ? SearchIcon : SquarePenIcon;
    const label = kind === "research" ? "新调研" : "新对话";

    return (
      <SidebarItemButton
        ref={ref}
        isActive={pathname === "/" && isNewThread && selectedKind === kind}
        data-slot="aui_thread-list-new"
        className={className}
        {...props}
        onClick={(event) => {
          onClick?.(event);
          if (event.defaultPrevented) return;

          selectNewKind(kind);

          aui.threads.switchToNewThread();

          router.replace("/");
        }}
      >
        {children ?? (
          <>
            <Icon data-slot="aui_thread-list-new-icon" />
            <span data-slot="aui_thread-list-new-label">{label}</span>
          </>
        )}
      </SidebarItemButton>
    );
  },
);

ThreadListNew.displayName = "ThreadListNew";

const ThreadListSkeleton: FC = () => {
  return (
    <div
      role="status"
      aria-label="正在加载对话"
      className="flex flex-col gap-0.5"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          data-slot="aui_thread-list-skeleton-wrapper"
          className="flex h-8 items-center px-2.5"
        >
          <Skeleton
            data-slot="aui_thread-list-skeleton"
            className="h-3.5 w-full"
          />
        </div>
      ))}
    </div>
  );
};

export const ThreadListItem: FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { kind: selectedKind } = useNewConversationKind();
  const isActive = useAuiState(
    (state) => state.threads.mainThreadId === state.threadListItem.id,
  );
  const savedKind = useAuiState(
    (state) =>
      state.threadListItem.custom?.kind as ConversationKind | undefined,
  );
  const isResearch =
    (savedKind ?? (isActive ? selectedKind : "chat")) === "research";

  return (
    <ThreadListItemPrimitive.Root
      data-slot="aui_thread-list-item"
      className="group/thread-item relative"
    >
      <SidebarItemButton
        asChild
        isActive={pathname === "/" && isActive}
        className="group-hover/thread-item:pe-9 group-has-focus-visible/thread-item:pe-9 group-has-data-[state=open]/thread-item:bg-sidebar-accent group-has-data-[state=open]/thread-item:pe-9"
      >
        <ThreadListItemPrimitive.Trigger
          data-slot="aui_thread-list-item-trigger"
          onClick={() => router.replace("/")}
        >
          {isResearch ? (
            <SearchIcon aria-hidden="true" />
          ) : (
            <MessageCircleIcon aria-hidden="true" />
          )}
          <span data-slot="aui_thread-list-item-title">
            <ThreadListItemPrimitive.Title
              fallback={isResearch ? "新调研" : "新对话"}
            />
          </span>
        </ThreadListItemPrimitive.Trigger>
      </SidebarItemButton>
      <ThreadListItemMore />
    </ThreadListItemPrimitive.Root>
  );
};

type ThreadListItemMoreProps = {
  align?: "start" | "center" | "end";
  disabled?: boolean;
  side?: "top" | "right" | "bottom" | "left";
  sharedFocusGroup?: boolean;
  triggerClassName?: string;
};

export const ThreadListItemMore: FC<ThreadListItemMoreProps> = ({
  align = "start",
  disabled = false,
  sharedFocusGroup = true,
  side = "right",
  triggerClassName,
}) => {
  const aui = useAui();
  const currentTitle = useAuiState((state) => state.threadListItem.title ?? "");
  const [isRenameOpen, setRenameOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const [isDeleteOpen, setDeleteOpen] = useState(false);
  const item = useAuiState((state) => state.threadListItem);
  const refreshConversations = () => aui.threads.reload();

  const renameMutation = useMutation({
    mutationFn: (title: string) =>
      agentRenameConversation({
        path: { conversation_id: item.remoteId! },
        body: { title },
        throwOnError: true,
      }),
    onSuccess: () => {
      toast.success("会话已重命名");
      setRenameOpen(false);

      void refreshConversations();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "重命名失败，请重试"));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () =>
      agentArchiveConversation({
        path: { conversation_id: item.remoteId! },
        throwOnError: true,
      }),
    onSuccess: () => {
      toast.success("会话已归档");
      if (aui.threads.getState().mainThreadId === item.id)
        aui.threads.switchToNewThread();

      void refreshConversations();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "归档失败，请重试"));
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: () =>
      agentDeleteConversation({
        path: { conversation_id: item.remoteId! },
        throwOnError: true,
      }),
    onSuccess: () => {
      toast.success("会话已删除");
      setDeleteOpen(false);
      if (aui.threads.getState().mainThreadId === item.id)
        aui.threads.switchToNewThread();

      void refreshConversations();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, "删除会话失败，请重试"));
    },
  });

  const isPending =
    renameMutation.isPending ||
    archiveMutation.isPending ||
    deleteConversationMutation.isPending;

  const renameConversation = (event: SubmitEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const title = newTitle.trim();
    if (!title || isPending) return;

    renameMutation.mutate(title);
  };

  return (
    <ThreadListItemMorePrimitive.Root sharedFocusGroup={sharedFocusGroup}>
      <ThreadListItemMorePrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled || isPending || !item.remoteId}
          data-slot="aui_thread-list-item-more"
          className={cn(
            "data-[state=open]:bg-accent data-[state=open]:opacity-100",
            triggerClassName ??
              "absolute end-1.5 top-1/2 size-6 -translate-y-1/2 opacity-0 group-hover/thread-item:opacity-100",
          )}
        >
          <MoreHorizontalIcon />
          <span className="sr-only">更多操作</span>
        </Button>
      </ThreadListItemMorePrimitive.Trigger>
      <ThreadListItemMorePrimitive.Content
        side={side}
        align={align}
        sideOffset={6}
        data-slot="aui_thread-list-item-more-content"
        className="bg-popover/95 text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-32 overflow-hidden rounded-xl border p-1.5 shadow-lg backdrop-blur-sm"
      >
        <ThreadListItemMorePrimitive.Item
          data-slot="aui_thread-list-item-more-item"
          className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
          onSelect={() => {
            setNewTitle(currentTitle);
            setRenameOpen(true);
          }}
        >
          <PencilIcon className="size-4" />
          重命名
        </ThreadListItemMorePrimitive.Item>

        <ThreadListItemMorePrimitive.Item
          disabled={isPending}
          onSelect={() => archiveMutation.mutate()}
          data-slot="aui_thread-list-item-more-item"
          className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
        >
          <ArchiveIcon className="size-4" />
          归档
        </ThreadListItemMorePrimitive.Item>

        <ThreadListItemMorePrimitive.Item
          disabled={isPending}
          onSelect={() => setDeleteOpen(true)}
          data-slot="aui_thread-list-item-more-item"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
        >
          <TrashIcon className="size-4" />
          删除
        </ThreadListItemMorePrimitive.Item>
      </ThreadListItemMorePrimitive.Content>

      <Dialog
        open={isRenameOpen}
        onOpenChange={(open) => {
          if (!isPending) setRenameOpen(open);
        }}
      >
        <DialogContent showCloseButton={!isPending}>
          <DialogHeader>
            <DialogTitle>重命名对话</DialogTitle>
            <DialogDescription>输入新的对话标题。</DialogDescription>
          </DialogHeader>
          <form onSubmit={renameConversation}>
            <Input
              autoFocus
              aria-label="对话标题"
              disabled={isPending}
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
            />
            <DialogFooter className="mt-4">
              <Button type="submit" disabled={isPending || !newTitle.trim()}>
                {renameMutation.isPending ? "保存中…" : "保存"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={isDeleteOpen}
        onOpenChange={(open) => {
          if (!isPending) setDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除会话？</AlertDialogTitle>
            <AlertDialogDescription>
              将永久删除“{currentTitle || "未命名会话"}”，此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteConversationMutation.mutate();
              }}
            >
              {deleteConversationMutation.isPending ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ThreadListItemMorePrimitive.Root>
  );
};
