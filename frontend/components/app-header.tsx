import type { ReactNode } from "react";

type AppHeaderProps = {
  title: string;
  left?: ReactNode;
  actions?: ReactNode;
};

export function AppHeader({ title, left, actions }: AppHeaderProps) {
  return (
    <header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b px-3">
      <div className="min-w-0 justify-self-start">
        {left}
      </div>
      <h1 className="max-w-[40vw] truncate text-sm font-medium sm:max-w-96">
        {title}
      </h1>
      <div className="min-w-0 justify-self-end">{actions}</div>
    </header>
  );
}
