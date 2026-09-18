import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type AppHeaderProps = {
  title: string;
  left?: ReactNode;
  breadcrumbs?: { label: string; href: string }[];
  actions?: ReactNode;
};

export function AppHeader({
  title,
  left,
  actions,
  breadcrumbs,
}: AppHeaderProps) {
  if (breadcrumbs) {
    return (
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-3">
        <SidebarTrigger className="size-9" aria-label="切换侧栏" />
        <h1 className="sr-only">{title}</h1>
        <Breadcrumb aria-label="页面路径" className="min-w-0 flex-1">
          <BreadcrumbList className="flex-nowrap">
            {breadcrumbs.map(({ label, href }) => (
              <Fragment key={href}>
                <BreadcrumbItem className="min-w-0 max-w-32 sm:max-w-64">
                  <BreadcrumbLink asChild className="truncate" title={label}>
                    <Link href={href}>{label}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </Fragment>
            ))}
            <BreadcrumbItem className="min-w-0">
              <BreadcrumbPage className="truncate" title={title}>
                {title}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>
    );
  }
  return (
    <header className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b px-3">
      <div className="min-w-0 justify-self-start">{left}</div>
      <h1 className="max-w-[40vw] truncate text-sm font-medium sm:max-w-96">
        {title}
      </h1>
      <div className="min-w-0 justify-self-end">{actions}</div>
    </header>
  );
}
