import type { ReactNode } from "react";

import { ThreadListPopover } from "@/components/thread-list-popover";

type AppHeaderProps = {
  title: string;
  left?: ReactNode;
  actions?: ReactNode;
};

export function AppHeader({ title, left, actions }: AppHeaderProps) {
  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b px-3">
      <div className="justify-self-start">{left ?? <ThreadListPopover />}</div>
      <h1 className="max-w-96 truncate text-sm font-medium">{title}</h1>
      <div className="justify-self-end">{actions}</div>
    </header>
  );
}
