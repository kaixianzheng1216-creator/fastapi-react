"use client";

import { Button } from "@/components/ui/button";
import {
  CommandDialog,
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
  searchConversations,
  stopConversationRun,
} from "@/lib/conversation-thread-list-adapter";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
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
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [search, setSearch] = useState("");
  const open = controlledOpen ?? uncontrolledOpen;

  function setOpen(value: boolean): void {
    setUncontrolledOpen(value);
    onOpenChange?.(value);
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
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={archived ? "已归档对话" : "搜索对话"}
        description={archived ? "查看已归档的对话" : "搜索已有对话"}
        className="max-h-[80dvh] sm:max-w-3xl"
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
                onSelect={() => {
                  aui.threads.switchToNewThread();
                  router.replace("/");
                  setOpen(false);
                }}
              >
                <SquarePenIcon />
                新对话
              </CommandItem>
            </CommandGroup>
          )}
          <ThreadListSearchResults
            archived={archived}
            searchQuery={search.trim()}
            onSelect={() => setOpen(false)}
          />
        </CommandList>
      </CommandDialog>
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
      <AuiIf condition={(s) => s.threads.isLoading}>
        <ThreadListSkeleton />
      </AuiIf>
      <AuiIf condition={(s) => !s.threads.isLoading}>
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
    if (!indices.some((index) => dates[index])) {
      return null;
    }

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

  if (!groups) {
    return threadIds.map((threadId, index) => (
      <ThreadListPrimitive.ItemByIndex
        key={threadId}
        index={index}
        components={{ ThreadListItem }}
      />
    ));
  }

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
  const [debouncedSearchQuery] = useDebounce(
    searchQuery,
    SEARCH_DEBOUNCE_MS,
  );

  const {
    data: results,
    isError,
    isFetching,
  } = useQuery({
    queryKey: ["conversations", "search", debouncedSearchQuery, archived],
    queryFn: ({ signal }) =>
      searchConversations(
        debouncedSearchQuery || undefined,
        archived,
        signal,
      ),
    retry: false,
  });

  if (searchQuery !== debouncedSearchQuery || isFetching) {
    return <ThreadListSkeleton />;
  }
  if (isError) return <CommandEmpty>搜索失败</CommandEmpty>;
  if (!results) return <ThreadListSkeleton />;
  if (results.length === 0) {
    return (
      <div className="text-muted-foreground py-6 text-center text-sm">
        未找到对话
      </div>
    );
  }

  return (
    <CommandGroup
      heading={searchQuery ? "搜索结果" : archived ? "已归档对话" : "最近对话"}
    >
      {results.map((conversation) => (
        <CommandItem
          key={conversation.id}
          className="group"
          value={`${conversation.title} ${conversation.id}`}
          onSelect={() => {
            void aui.threads.switchToThread(conversation.id);
            router.replace("/");
            onSelect();
          }}
        >
          <MessageCircleIcon />
          <span className="min-w-0 flex-1 truncate">{conversation.title}</span>
          <span className="text-muted-foreground text-xs group-hover:hidden">
            {formatConversationTime(conversation.updatedAt)}
          </span>
          <CornerUpLeftIcon className="hidden group-hover:block" />
        </CommandItem>
      ))}
    </CommandGroup>
  );
};

export const ThreadListNew = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithoutRef<typeof SidebarItemButton>
>(({ className, children, onClick, ...props }, ref) => {
  const aui = useAui();
  const pathname = usePathname();
  const router = useRouter();
  const isNewThread = useAuiState(
    (state) => state.threads.newThreadId === state.threads.mainThreadId,
  );

  return (
    <SidebarItemButton
      ref={ref}
      isActive={pathname === "/" && isNewThread}
      data-slot="aui_thread-list-new"
      className={className}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          aui.threads.switchToNewThread();
          router.replace("/");
        }
      }}
    >
      {children ?? (
        <>
          <SquarePenIcon data-slot="aui_thread-list-new-icon" />
          <span data-slot="aui_thread-list-new-label">新对话</span>
        </>
      )}
    </SidebarItemButton>
  );
});

ThreadListNew.displayName = "ThreadListNew";

const ThreadListSkeleton: FC = () => {
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          role="status"
          aria-label="正在加载对话"
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
  const isActive = useAuiState(
    (state) => state.threads.mainThreadId === state.threadListItem.id,
  );

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
          <MessageCircleIcon aria-hidden="true" />
          <span data-slot="aui_thread-list-item-title">
            <ThreadListItemPrimitive.Title fallback="新对话" />
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

  async function deleteConversation(): Promise<void> {
    const remoteId = aui.threadListItem.getState().remoteId;
    if (!remoteId) throw new Error("对话缺少远程 ID");

    await stopConversationRun(remoteId);
    await aui.threadListItem.delete();
  }

  const renameConversation = async (
    event: SubmitEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    const title = newTitle.trim();
    if (!title) return;

    await aui.threadListItem.rename(title);
    setRenameOpen(false);
  };

  return (
    <ThreadListItemMorePrimitive.Root sharedFocusGroup={sharedFocusGroup}>
      <ThreadListItemMorePrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
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
        <ThreadListItemPrimitive.Archive asChild>
          <ThreadListItemMorePrimitive.Item
            data-slot="aui_thread-list-item-more-item"
            className="hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
          >
            <ArchiveIcon className="size-4" />
            归档
          </ThreadListItemMorePrimitive.Item>
        </ThreadListItemPrimitive.Archive>
        <ThreadListItemMorePrimitive.Item
          data-slot="aui_thread-list-item-more-item"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none"
          onSelect={() => {
            void deleteConversation().catch((error: unknown) => {
              console.error("删除对话失败", error);
            });
          }}
        >
          <TrashIcon className="size-4" />
          删除
        </ThreadListItemMorePrimitive.Item>
      </ThreadListItemMorePrimitive.Content>

      <Dialog open={isRenameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重命名对话</DialogTitle>
            <DialogDescription>输入新的对话标题。</DialogDescription>
          </DialogHeader>
          <form onSubmit={renameConversation}>
            <Input
              autoFocus
              aria-label="对话标题"
              value={newTitle}
              onChange={(event) => setNewTitle(event.target.value)}
            />
            <DialogFooter className="mt-4">
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ThreadListItemMorePrimitive.Root>
  );
};
