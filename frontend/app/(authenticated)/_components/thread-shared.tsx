"use client";

import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/app/(authenticated)/_components/attachment";
import { ComposerModelSelector } from "@/app/(authenticated)/_components/composer-model-selector";
import { TooltipIconButton } from "@/app/(authenticated)/_components/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MicIcon,
  PencilIcon,
  SquareIcon,
} from "lucide-react";
import type { FC, PropsWithChildren, ReactNode } from "react";

export type ThreadWelcomeProps = {
  title: string;
};

type ThreadShellProps = PropsWithChildren<{
  isEmpty: boolean;
  maxWidth: string;
  footer: ReactNode;
}>;

export const ThreadShell: FC<ThreadShellProps> = ({
  isEmpty,
  maxWidth,
  footer,
  children,
}) => (
  <ThreadPrimitive.Root
    className="aui-root aui-thread-root bg-background @container flex h-full flex-col"
    style={{
      ["--thread-max-width" as string]: maxWidth,
      ["--composer-bg" as string]:
        "color-mix(in oklab, var(--color-muted) 30%, var(--color-background))",
      ["--composer-radius" as string]: "1.5rem",
      ["--composer-padding" as string]: "8px",
    }}
  >
    <ThreadPrimitive.Viewport
      turnAnchor="top"
      data-slot="aui_thread-viewport"
      className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth 2xl:[scrollbar-width:none] 2xl:[&::-webkit-scrollbar]:hidden"
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4",
          isEmpty && "justify-center",
        )}
      >
        {children}

        <ThreadPrimitive.ViewportFooter
          className={cn(
            "aui-thread-viewport-footer bg-background flex flex-col gap-4 overflow-visible pb-4 md:pb-6",
            !isEmpty &&
              "sticky bottom-0 mt-auto rounded-t-(--composer-radius)",
          )}
        >
          <ThreadScrollToBottom />
          {footer}
        </ThreadPrimitive.ViewportFooter>
      </div>
    </ThreadPrimitive.Viewport>
  </ThreadPrimitive.Root>
);

const ThreadScrollToBottom: FC = () => (
  <ThreadPrimitive.ScrollToBottom asChild>
    <TooltipIconButton
      tooltip="滚动到底部"
      variant="outline"
      className="aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible"
    >
      <ArrowDownIcon />
    </TooltipIconButton>
  </ThreadPrimitive.ScrollToBottom>
);

export const ThreadWelcome: FC<ThreadWelcomeProps> = ({ title }) => (
  <div className="aui-thread-welcome-root mb-6 flex flex-col items-center px-4 text-center">
    <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-semibold duration-200 motion-reduce:animate-none">
      {title}
    </h1>
  </div>
);

export const Composer: FC = () => (
  <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
    <ComposerPrimitive.AttachmentDropzone asChild>
      <div
        data-slot="aui_composer-shell"
        className="border-border/60 data-[dragging=true]:border-ring focus-within:border-border dark:border-muted-foreground/15 dark:focus-within:border-muted-foreground/30 flex w-full flex-col gap-2 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] focus-within:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.05)] data-[dragging=true]:border-dashed data-[dragging=true]:bg-[color-mix(in_oklab,var(--color-accent)_50%,var(--color-background))] dark:shadow-none"
      >
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="请输入消息…"
          className="aui-composer-input caret-primary placeholder:text-muted-foreground/80 max-h-32 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base outline-none"
          rows={1}
          enterKeyHint="send"
          aria-label="消息输入框"
        />
        <ComposerAction />
      </div>
    </ComposerPrimitive.AttachmentDropzone>
  </ComposerPrimitive.Root>
);

const ComposerAction: FC = () => (
  <div className="aui-composer-action-wrapper relative flex items-center justify-between">
    <div className="flex items-center">
      <ComposerAddAttachment />
      <ComposerModelSelector />
    </div>
    <div className="flex items-center gap-1.5">
      <AuiIf condition={(state) => state.thread.capabilities.dictation}>
        <AuiIf condition={(state) => state.composer.dictation == null}>
          <ComposerPrimitive.Dictate asChild>
            <TooltipIconButton
              tooltip="语音输入"
              side="bottom"
              type="button"
              variant="ghost"
              size="icon"
              className="aui-composer-dictate size-7 rounded-full"
              aria-label="开始语音输入"
            >
              <MicIcon className="aui-composer-dictate-icon size-4" />
            </TooltipIconButton>
          </ComposerPrimitive.Dictate>
        </AuiIf>
        <AuiIf condition={(state) => state.composer.dictation != null}>
          <ComposerPrimitive.StopDictation asChild>
            <TooltipIconButton
              tooltip="停止听写"
              side="bottom"
              type="button"
              variant="ghost"
              size="icon"
              className="aui-composer-stop-dictation text-destructive size-7 rounded-full"
              aria-label="停止语音输入"
            >
              <SquareIcon className="aui-composer-stop-dictation-icon size-3.5 animate-pulse fill-current" />
            </TooltipIconButton>
          </ComposerPrimitive.StopDictation>
        </AuiIf>
      </AuiIf>
      <AuiIf condition={(state) => !state.thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="发送消息"
            side="bottom"
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-send size-7 rounded-full"
            aria-label="发送消息"
          >
            <ArrowUpIcon className="aui-composer-send-icon size-4.5" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(state) => state.thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-cancel size-7 rounded-full"
            aria-label="停止生成"
          >
            <SquareIcon className="aui-composer-cancel-icon size-3.5 fill-current" />
          </Button>
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </div>
  </div>
);

export const UserMessage: FC = () => (
  <MessagePrimitive.Root
    data-slot="aui_user-message-root"
    className="fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto] [&:where(>*)]:col-start-2"
    data-role="user"
  >
    <UserMessageAttachments />

    <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
      <div className="aui-user-message-content peer bg-muted text-foreground rounded-xl px-4 py-2 wrap-break-word empty:hidden">
        <MessagePrimitive.Parts />
      </div>

      {/* 编辑后端恢复前暂时隐藏；取消下面区块注释即可恢复入口。 */}
      {/*
      <div className="aui-user-action-bar-wrapper absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full">
        <UserActionBar />
      </div>
      */}
    </div>

    <BranchPicker
      data-slot="aui_user-branch-picker"
      className="col-span-full col-start-1 row-start-3 -me-1 justify-end"
    />
  </MessagePrimitive.Root>
);

const UserActionBar: FC = () => (
  <ActionBarPrimitive.Root
    hideWhenRunning
    autohide="not-last"
    className="aui-user-action-bar-root flex flex-col items-end"
  >
    <AuiIf
      condition={(state) =>
        state.thread.messages.findLast((message) => message.role === "user")
          ?.id === state.message.id
      }
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="编辑" className="aui-user-action-edit">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </AuiIf>
  </ActionBarPrimitive.Root>
);

export const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => (
  <AuiIf condition={(state) => state.thread.capabilities.switchToBranch}>
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root text-muted-foreground -ms-2 me-2 inline-flex items-center text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="上一个">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="下一个">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  </AuiIf>
);
